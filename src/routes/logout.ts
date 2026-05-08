import { NextResponse } from 'next/server.js';
import type { Config } from '../config/types';
import { type HandlerErrorCause, LogoutHandlerError } from '../errors/handlers';
import type { MondoInstance } from '../core/instance';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type { SessionStoreInterface } from '../session/stores/types';
import type { Claims } from '../session/types';
import { pathOrURLToURL, toSafeRedirect } from '../http/url';

/**
 * Options for clearing the local session and choosing the post-logout redirect.
 */
export interface LogoutOptions {
  /**
   * Application path to return to after logout.
   */
  returnTo?: string;

  /**
   * If set to `true`, the logout will also log out the user from the identity provider.
   * This is useful for Single Sign Out (SSO) scenarios.
   * If set to `false`, the user will only be logged out from the application.
   * Defaults to `false`.
   */
  singleLogOut?: boolean;
}

/**
 * Builds a route handler for the configured logout route.
 */
export type LogoutHandler = (
  options?: LogoutOptions,
) => (req: Request) => Promise<Response>;

/**
 * Creates a logout handler bound to one auth client instance.
 *
 * The returned handler destroys all session cookies and redirects either to the
 * configured application URL or to the provider logout endpoint for SSO logout.
 *
 * @param instance - Validated auth client instance.
 */
export const logoutHandlerFactory =
  <UserClaims extends Claims>(instance: MondoInstance): LogoutHandler =>
  (options?: LogoutOptions) =>
  async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);

      return await handler<UserClaims>(
        instance,
        sessionStoreFactory<UserClaims>(instance.config),
        buildOptions(
          instance.config,
          options,
          url.searchParams.get('returnTo'),
        ),
      );
    } catch (e) {
      throw new LogoutHandlerError(e as HandlerErrorCause);
    }
  };

async function handler<UserClaims extends Claims>(
  { config }: MondoInstance,
  sessionCache: SessionStoreInterface<UserClaims>,
  options?: LogoutOptions,
): Promise<Response> {
  let returnURL = pathOrURLToURL(
    config,
    options?.returnTo || config.routes.postLogoutRedirect,
  );

  await sessionCache.delete();

  if (options?.singleLogOut) {
    returnURL = new URL(
      ['/logout', `redirectTo=${returnURL.toString()}`].join('?'),
      config.issuerBaseURL,
    );
  }

  return NextResponse.redirect(returnURL);
}

/**
 * Merges static logout options with a request `returnTo` value.
 *
 * The query string value is treated as untrusted input and must resolve to the
 * configured application origin.
 */
const buildOptions = (
  config: Config,
  opts?: LogoutOptions,
  dangerousReturnTo?: string | undefined | null,
): LogoutOptions => {
  const options = opts || {};

  if (dangerousReturnTo) {
    const safeBaseUrl = new URL(config.baseURL);
    options.returnTo = toSafeRedirect(dangerousReturnTo, safeBaseUrl);
  }

  return options;
};
