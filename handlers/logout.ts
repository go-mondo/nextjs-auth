import { NextResponse } from 'next/server';
import type { Config } from '../config/types';
import { type HandlerErrorCause, LogoutHandlerError } from '../errors/handlers';
import type { MondoInstance } from '../init';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type { SessionStoreInterface } from '../session/stores/types';
import type { Claims } from '../session/types';
import { pathOrURLToURL, toSafeRedirect } from '../utils/http';

/**
 * Options to customize the logout handler.
 *
 * @see {@link HandleLogout}
 *
 * @category Server
 */
export interface LogoutOptions {
  /**
   * URL to return to after logout. Overrides the default
   * in {@link BaseConfig.routes.postLogoutRedirect routes.postLogoutRedirect}.
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
 * Use this to customize the default logout handler without overriding it.
 * You can still override the handler if needed.
 *
 * @example Pass an options object
 *
 * ```js
 * // pages/api/auth/[auth0].js
 * import { handleAuth, handleLogout } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   logout: handleLogout({ returnTo: 'https://example.com' })
 * });
 * ```
 *
 * @example Pass a function that receives the request and returns an options object
 *
 * ```js
 * // pages/api/auth/[auth0].js
 * import { handleAuth, handleLogout } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   logout: handleLogout((req) => {
 *     return { returnTo: 'https://example.com' };
 *   })
 * });
 * ```
 *
 * This is useful for generating options that depend on values from the request.
 *
 * @example Override the logout handler
 *
 * ```js
 * import { handleAuth, handleLogout } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   logout: async (req, res) => {
 *     try {
 *       await handleLogout(req, res, {
 *         returnTo: 'https://example.com'
 *       });
 *     } catch (error) {
 *       console.error(error);
 *     }
 *   }
 * });
 * ```
 *
 * @category Server
 */
export type LogoutHandler = (
  options?: LogoutOptions
) => (req: Request) => Promise<Response>;

/**
 * Create a new login handler
 *
 * @param instance
 * @returns
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
        buildOptions(instance.config, options, url.searchParams.get('returnTo'))
      );
    } catch (e) {
      throw new LogoutHandlerError(e as HandlerErrorCause);
    }
  };

async function handler<UserClaims extends Claims>(
  { config }: MondoInstance,
  sessionCache: SessionStoreInterface<UserClaims>,
  options?: LogoutOptions
): Promise<Response> {
  let returnURL = pathOrURLToURL(
    config,
    options?.returnTo || config.routes.postLogoutRedirect
  );

  // Delete session from cache
  await sessionCache.delete();

  // For single log out, point to the logout endpoint and redirect back here
  if (options?.singleLogOut) {
    returnURL = new URL(
      ['/logout', `redirectTo=${returnURL.toString()}`].join('?'),
      config.issuerBaseURL
    );
  }

  console.debug(`Logout redirect url: ${returnURL}`);

  return NextResponse.redirect(returnURL);
}

const buildOptions = (
  config: Config,
  opts?: LogoutOptions,
  dangerousReturnTo?: string | undefined | null
): LogoutOptions => {
  const options = opts || {};

  if (dangerousReturnTo) {
    const safeBaseUrl = new URL(config.baseURL);
    options.returnTo = toSafeRedirect(dangerousReturnTo, safeBaseUrl);
  }

  return options;
};
