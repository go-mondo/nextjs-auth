import { NextResponse } from 'next/server.js';
import {
  type AccessTokenResult,
  type GetAccessTokenOptions,
  getAccessTokenFactory,
} from '../oidc/access-token';
import { AccessTokenError, AccessTokenErrorCode } from '../errors/access-token';
import type { MondoInstance } from '../core/instance';
import type { Claims } from '../session/types';

export interface AccessTokenOptions extends GetAccessTokenOptions {
  /**
   * Optional projection applied before the route returns JSON.
   */
  transform?: (token: AccessTokenResult) => unknown;
}

/**
 * Builds a route handler for the configured access-token route.
 */
export type AccessTokenHandler = (
  options?: AccessTokenOptions,
) => (req: Request) => Promise<Response>;

/**
 * Creates an access-token handler bound to one auth client instance.
 *
 * The returned handler exposes the same refresh behavior as
 * `auth.getAccessToken()` and maps stable access-token error codes to HTTP
 * statuses.
 *
 * @param instance - Validated auth client instance.
 */
export const accessTokenHandlerFactory =
  <UserClaims extends Claims>(instance: MondoInstance): AccessTokenHandler =>
  (options?: AccessTokenOptions) =>
  async (_req: Request): Promise<Response> => {
    try {
      const token = await getAccessTokenFactory<UserClaims>(instance)(options);
      return NextResponse.json(options?.transform?.(token) ?? token);
    } catch (error) {
      if (error instanceof AccessTokenError) {
        return NextResponse.json(
          {
            error: error.code,
            error_description: error.message,
          },
          { status: getStatusCode(error.code as AccessTokenErrorCode) },
        );
      }

      throw error;
    }
  };

function getStatusCode(code: AccessTokenErrorCode): number {
  switch (code) {
    case AccessTokenErrorCode.MISSING_SESSION:
    case AccessTokenErrorCode.MISSING_ACCESS_TOKEN:
    case AccessTokenErrorCode.MISSING_REFRESH_TOKEN:
    case AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN:
      return 401;
    case AccessTokenErrorCode.INSUFFICIENT_SCOPE:
      return 403;
    case AccessTokenErrorCode.FAILED_REFRESH_GRANT:
      return 502;
  }
}
