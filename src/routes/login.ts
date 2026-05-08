import { NextResponse } from 'next/server.js';
import type { Config } from '../config/types';
import { cookieFactory } from '../http/cookies';
import { type HandlerErrorCause, LoginHandlerError } from '../errors/handlers';
import type { MondoInstance } from '../core/instance';
import {
  type AuthVerification,
  type TransactionStore,
  transactionStoreFactory,
} from '../transactions/store';
import {
  type AuthorizationCodeParams,
  CodeChallengeMethod,
  type OverrideAuthorizationParams,
} from '../oauth/types';
import { discoverOIDC } from '../oauth/oidc';
import { getAuthorizationRedirectURL, toSafeRedirect } from '../http/url';

type AuthorizationParams = OverrideAuthorizationParams;

export interface LoginOptions {
  /**
   * Override the default authorization parameters for this login request.
   */
  authorization?: Partial<AuthorizationParams>;

  /**
   * URL to return to after login. Overrides the default in {@link BaseConfig.baseURL}.
   */
  returnTo?: string;
}

/**
 * Builds a route handler for the configured login route.
 */
export type LoginHandler = (
  options?: LoginOptions,
) => (req: Request) => Promise<Response>;

/**
 * Creates a login handler bound to one auth client instance.
 *
 * The returned handler creates PKCE verification state, stores it in the
 * transaction cookie, and redirects the user to the provider authorization URL.
 *
 * @param instance - Validated auth client instance.
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

  const returnTo = options?.returnTo || config.baseURL;

  const authVerification: AuthVerification = {
    nonce: oidc.randomNonce(),
    state: oidc.randomState(),
    code_verifier: oidc.randomPKCECodeVerifier(),
    return_to: returnTo,
  };

  const parameters: AuthorizationCodeParams = {
    redirect_uri: getAuthorizationRedirectURL(config, requestOrigin).toString(),
    ...config.authorization,
    ...(options?.authorization || {}),
    nonce: authVerification.nonce,
    state: authVerification.state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: await oidc.calculatePKCECodeChallenge(
      authVerification.code_verifier,
    ),
  };

  if (parameters.max_age) {
    authVerification.max_age = parameters.max_age;
  }

  await transactionStore.save(authVerification);

  const clientConfig = await discoverOIDC(config);

  const authorizationUrl = oidc.buildAuthorizationUrl(
    clientConfig,
    toAuthorizationUrlParameters(parameters),
  );

  return NextResponse.redirect(authorizationUrl);
}

function toAuthorizationUrlParameters(
  parameters: AuthorizationCodeParams,
): Record<string, string> {
  const authorizationUrlParameters: Record<string, string> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) {
      authorizationUrlParameters[key] = String(value);
    }
  }

  return authorizationUrlParameters;
}

/**
 * Merges static login options with a request `returnTo` value.
 *
 * The query string value is treated as untrusted input and must resolve to the
 * same origin as the application or current request.
 */
const buildOptions = (
  config: Config,
  opts?: LoginOptions,
  dangerousReturnTo?: string | undefined | null,
  requestOrigin?: string,
): LoginOptions => {
  const options = opts || {};

  if (dangerousReturnTo) {
    const safeBaseUrl = new URL(
      options?.authorization?.redirect_uri || requestOrigin || config.baseURL,
    );
    options.returnTo = toSafeRedirect(dangerousReturnTo, safeBaseUrl);
  }

  return options;
};
