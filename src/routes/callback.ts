import { NextResponse } from 'next/server.js';
import type * as oidc from 'openid-client';
import { cookieFactory } from '../http/cookies';
import {
  CallbackHandlerError,
  type HandlerErrorCause,
} from '../errors/handlers';
import { MissingStateCookieError } from '../errors/state';
import type { MondoInstance } from '../core/instance';
import { fromTokenEndpointResponse } from '../session/model';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type { SessionStoreInterface } from '../session/stores/types';
import type { Claims } from '../session/types';
import {
  type TransactionStore,
  transactionStoreFactory,
} from '../transactions/store';
import { discoverOIDC } from '../oidc/discovery';

export interface CallbackOptions {
  /**
   * Additional parameters sent to the token endpoint during code exchange.
   */
  tokenParameters?: URLSearchParams | Record<string, string>;
}

/**
 * Builds a route handler for the configured callback route.
 */
export type CallbackHandler = (
  options?: CallbackOptions,
) => (req: Request) => Promise<Response>;

/**
 * Creates a callback handler bound to one auth client instance.
 *
 * The returned handler verifies PKCE, state, and nonce, exchanges the code for
 * tokens, stores the sealed session cookies, and redirects back to `returnTo`.
 *
 * @param instance - Validated auth client instance.
 */
export const callbackHandlerFactory =
  <UserClaims extends Claims>(instance: MondoInstance) =>
  (options?: CallbackOptions) =>
  async (req: Request): Promise<Response> => {
    try {
      const cookieStore = await cookieFactory(req);

      return await handler<UserClaims>(
        instance,
        new URL(req.url),
        transactionStoreFactory(instance.config, cookieStore),
        sessionStoreFactory<UserClaims>(instance.config),
        options,
      );
    } catch (e) {
      throw new CallbackHandlerError(e as HandlerErrorCause);
    }
  };

async function handler<UserClaims extends Claims>(
  { config }: MondoInstance,
  requestUrl: URL,
  transactionStore: TransactionStore,
  sessionStore: SessionStoreInterface<UserClaims>,
  options?: CallbackOptions,
): Promise<Response> {
  const oidc = await import('openid-client');
  const authVerification = await transactionStore.read();
  if (!authVerification) {
    throw new MissingStateCookieError();
  }

  const clientConfig = await discoverOIDC(config);

  const tokens: oidc.TokenEndpointResponse = await oidc.authorizationCodeGrant(
    clientConfig,
    requestUrl,
    {
      pkceCodeVerifier: authVerification.code_verifier,
      expectedState: authVerification.state,
      expectedNonce: authVerification.nonce,
      idTokenExpected: true,
      maxAge: authVerification.max_age,
    },
    options?.tokenParameters,
  );

  const session = await fromTokenEndpointResponse<UserClaims>(tokens);
  if (session) {
    await sessionStore.set(session);
  }

  return NextResponse.redirect(authVerification.return_to || config.baseURL);
}
