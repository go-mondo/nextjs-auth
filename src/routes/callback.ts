import { NextResponse } from 'next/server.js';
import type * as oidc from 'openid-client';
import type { MondoInstance } from '../core/instance';
import {
  CallbackHandlerError,
  type HandlerErrorCause,
} from '../errors/handlers';
import {
  MismatchedStateParamError,
  MissingStateCookieError,
  MissingStateParamError,
} from '../errors/state';
import { cookieFactory } from '../http/cookies';
import { discoverOIDC } from '../oauth/oidc';
import { fromTokenEndpointResponse } from '../session/model';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type { SessionStoreInterface } from '../session/stores/types';
import type { Claims } from '../session/types';
import {
  type TransactionStore,
  transactionStoreFactory,
} from '../transactions/store';

export interface CallbackOptions {
  /**
   * Additional parameters sent to the token endpoint during code exchange.
   */
  tokenParameters?: URLSearchParams | Record<string, string>;
}

type AuthorizationErrorResponse = {
  error: string;
  error_description?: string;
};

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
      const cookieStore = await cookieFactory();

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

  const authorizationError = getAuthorizationError(requestUrl);
  if (authorizationError) {
    verifyState(requestUrl, authVerification.state);
    return authorizationErrorResponse(authorizationError);
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

function getAuthorizationError(
  requestUrl: URL,
): AuthorizationErrorResponse | undefined {
  const error = requestUrl.searchParams.get('error');

  if (!error) {
    return undefined;
  }

  const errorDescription = requestUrl.searchParams.get('error_description');

  return {
    error,
    ...(errorDescription ? { error_description: errorDescription } : {}),
  };
}

function verifyState(requestUrl: URL, expectedState: string): void {
  const state = requestUrl.searchParams.get('state');

  if (!state) {
    throw new MissingStateParamError();
  }

  if (state !== expectedState) {
    throw new MismatchedStateParamError();
  }
}

function authorizationErrorResponse({
  error,
  error_description,
}: AuthorizationErrorResponse): Response {
  const message =
    error === 'access_denied'
      ? 'Access was not granted. You can close this page and try signing in again.'
      : 'The authorization request could not be completed.';
  const detail = error_description || error;
  const popupScript =
    error === 'access_denied'
      ? authorizationErrorPopupScript({ error, error_description })
      : '';

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Authorization was not completed</title>
  </head>
  <body>
    <main>
      <h1>Authorization was not completed</h1>
      <p>${escapeHtml(message)}</p>
      <p>${escapeHtml(detail)}</p>
    </main>
    ${popupScript}
  </body>
</html>`,
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
      status: error === 'access_denied' ? 403 : 400,
    },
  );
}

function authorizationErrorPopupScript({
  error,
  error_description,
}: AuthorizationErrorResponse): string {
  return `<script>
(() => {
  if (!window.opener || window.opener.closed) return;
  window.opener.postMessage(${escapeScriptJson({
    type: 'mondo-auth:authorization-error',
    error,
    error_description,
  })}, window.location.origin);
  window.close();
})();
</script>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] as string,
  );
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
