import { NextResponse } from 'next/server.js';
import type { Config } from '../config/types';
import { cookieFactory } from '../cookie';
import { type HandlerErrorCause, LoginHandlerError } from '../errors/handlers';
import type { MondoInstance } from '../init';
import {
  type AuthVerification,
  type TransactionStore,
  transactionStoreFactory,
} from '../transaction-store';
import {
  type AuthorizationCodeParams,
  CodeChallengeMethod,
  type OverrideAuthorizationParams,
} from '../types';
import { getAuthorizationRedirectURL, toSafeRedirect } from '../utils/http';
import { discoverOIDC } from './utils';

type AuthorizationParams = OverrideAuthorizationParams;

export interface LoginOptions {
  /**
   * Override the default {@link BaseConfig.authorizationParams authorizationParams}.
   */
  authorizationParams?: Partial<AuthorizationParams>;

  /**
   * URL to return to after login. Overrides the default in {@link BaseConfig.baseURL}.
   */
  returnTo?: string;
}

/**
 * Use this to customize the default login handler without overriding it.
 * You can still override the handler if needed.
 *
 * @example Pass an options object
 *
 * ```js
 * // pages/api/auth/[auth0]
 * import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   login: handleLogin({
 *     authorizationParams: { connection: 'github' }
 *   })
 * });
 * ```
 *
 * @example Pass a function that receives the request and returns an options object
 *
 * ```js
 * // pages/api/auth/[auth0]
 * import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   login: handleLogin((req) => {
 *     return {
 *       authorizationParams: { connection: 'github' }
 *     };
 *   })
 * });
 * ```
 *
 * This is useful for generating options that depend on values from the request.
 *
 * @example Override the login handler
 *
 * ```js
 * import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   login: async (req, res) => {
 *     try {
 *       await handleLogin(req, res, {
 *         authorizationParams: { connection: 'github' }
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
export type LoginHandler = (
  options?: LoginOptions,
) => (req: Request) => Promise<Response>;

/**
 * Create a new login handler
 *
 * @param instance
 * @returns
 */
export const loginHandlerFactory =
  (instance: MondoInstance) =>
  (options?: LoginOptions) =>
  async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);

      return await handler(
        instance,
        transactionStoreFactory(instance.config, await cookieFactory(req)),
        buildOptions(
          instance.config,
          options,
          url.searchParams.get('returnTo'),
          url.origin,
        ),
        url.origin,
      );
    } catch (e) {
      console.error('Login handler error:', e);

      throw new LoginHandlerError(e as HandlerErrorCause);
    }
  };

async function handler(
  { config }: MondoInstance,
  transactionStore: TransactionStore,
  options?: LoginOptions,
  requestOrigin?: string,
): Promise<Response> {
  const oidc = await import('openid-client');

  // Where should we redirect the user after login
  const returnTo = options?.returnTo || config.baseURL;

  // Store these so we can reference them in the callback
  const authVerification: AuthVerification = {
    nonce: oidc.randomNonce(),
    state: oidc.randomState(),
    code_verifier: oidc.randomPKCECodeVerifier(),
    return_to: returnTo,
  };

  // Merge all authorization parameters together
  const parameters: AuthorizationCodeParams = {
    redirect_uri: getAuthorizationRedirectURL(config, requestOrigin).toString(),
    ...config.authorizationParams,
    ...(options?.authorizationParams || {}),
    nonce: authVerification.nonce,
    state: authVerification.state,
    code_challenge_method: CodeChallengeMethod.DEFAULT,
    code_challenge: await oidc.calculatePKCECodeChallenge(
      authVerification.code_verifier,
    ),
  };

  // Also add max_age if provided
  if (parameters.max_age) {
    authVerification.max_age = parameters.max_age;
  }

  // Store the auth verification in our transaction store
  await transactionStore.save(authVerification);

  const clientConfig = await discoverOIDC(config);

  const authorizationUrl = oidc.buildAuthorizationUrl(
    clientConfig,
    parameters as unknown as Record<string, string>,
  );

  return NextResponse.redirect(authorizationUrl);
}

const buildOptions = (
  config: Config,
  opts?: LoginOptions,
  dangerousReturnTo?: string | undefined | null,
  requestOrigin?: string,
): LoginOptions => {
  const options = opts || {};

  if (dangerousReturnTo) {
    const safeBaseUrl = new URL(
      options?.authorizationParams?.redirect_uri ||
        requestOrigin ||
        config.baseURL,
    );
    options.returnTo = toSafeRedirect(dangerousReturnTo, safeBaseUrl);
  }

  return options;
};
