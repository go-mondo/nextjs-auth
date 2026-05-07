import { NextResponse } from "next/server";
import * as oidc from "openid-client";
import { cookieFactory } from "../cookie";
import {
  CallbackHandlerError,
  type HandlerErrorCause,
} from "../errors/handlers";
import { MissingStateCookieError } from "../errors/state";
import type { MondoInstance } from "../init";
import { fromTokenEndpointResponse } from "../session/model";
import { sessionStoreFactory } from "../session/stores/stateless-store";
import type { SessionStoreInterface } from "../session/stores/types";
import type { Claims } from "../session/types";
import {
  type TransactionStore,
  transactionStoreFactory,
} from "../transaction-store";
import { discoverOIDC } from "./utils";

export interface CallbackOptions {
  /**
   * Parameters sent to the token request
   */
  tokenParameters?: URLSearchParams | Record<string, string>;

  // /**
  //  * This is useful for sending custom query parameters in the body of the code exchange request
  //  * for use in Actions/Rules.
  //  */
  // authorizationParams?: Partial<OverrideAuthorizationParams>;

  // /**
  //  * This is useful to specify in addition to {@link BaseConfig.baseURL} when your app runs on multiple domains,
  //  * it should match {@link LoginOptions.authorizationParams.redirect_uri}.
  //  */
  // redirectUri?: string;
}

/**
 * Use this to customize the default callback handler without overriding it.
 * You can still override the handler if needed.
 *
 * @example Pass an options object
 *
 * ```js
 * // pages/auth/[auth0].js
 * import { handleAuth, handleCallback } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   callback: handleCallback({ redirectUri: 'https://example.com' })
 * });
 * ```
 *
 * @example Pass a function that receives the request and returns an options object
 *
 * ```js
 * // pages/auth/[auth0].js
 * import { handleAuth, handleCallback } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   callback: handleCallback((req) => {
 *     return { redirectUri: 'https://example.com' };
 *   })
 * });
 * ```
 *
 * This is useful for generating options that depend on values from the request.
 *
 * @example Override the callback handler
 *
 * ```js
 * import { handleAuth, handleCallback } from '@auth0/nextjs-auth0';
 *
 * export default handleAuth({
 *   callback: async (req, res) => {
 *     try {
 *       await handleCallback(req, res, {
 *         redirectUri: 'https://example.com'
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
export type CallbackHandler = (
  options?: CallbackOptions,
) => (req: Request) => Promise<Response>;

/**
 * Create a new callback handler
 *
 * @param instance
 * @returns
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
  const authVerification = await transactionStore.read();
  if (!authVerification) {
    throw new MissingStateCookieError();
  }

  const clientConfig = await discoverOIDC(config);

  let tokens: oidc.TokenEndpointResponse;
  try {
    tokens = await oidc.authorizationCodeGrant(
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
  } catch (error) {
    console.error("Token exchange error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  const session = await fromTokenEndpointResponse<UserClaims>(tokens);
  if (session) {
    await sessionStore.set(session);
  }

  return NextResponse.redirect(authVerification.return_to || config.baseURL);
}

// function getRedirectUri(config: Config): string {
//   return urlJoin(config.baseURL, config.routes.callback);
// }
