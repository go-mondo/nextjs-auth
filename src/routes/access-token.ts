import { NextResponse } from 'next/server.js';
import {
  type AccessTokenResult,
  type GetAccessTokenOptions,
  getAccessTokenFactory,
} from '../oauth/access-token';
import { AccessTokenError, AccessTokenErrorCode } from '../errors/access-token';
import type { MondoInstance } from '../core/instance';
import type { Claims } from '../session/types';

export interface AccessTokenOptions extends GetAccessTokenOptions {
  /**
   * Optional projection applied before the route returns JSON.
   */
  transform?: (token: AccessTokenResult) => unknown;
}

type AccessTokenRequestOptions = Pick<
  GetAccessTokenOptions,
  'refresh' | 'refreshBeforeExpiresIn' | 'scopes'
>;

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
 * POST requests may provide `refresh`, `refreshBeforeExpiresIn`, and `scopes`
 * as JSON body options. Omitted body fields keep the static handler options.
 *
 * @param instance - Validated auth client instance.
 */
export const accessTokenHandlerFactory =
  <UserClaims extends Claims>(instance: MondoInstance): AccessTokenHandler =>
  (options?: AccessTokenOptions) =>
  async (req: Request): Promise<Response> => {
    try {
      const { transform, ...staticOptions } = options ?? {};
      const requestOptions = await getRequestOptions(req);
      const token = await getAccessTokenFactory<UserClaims>(instance)({
        ...staticOptions,
        ...(requestOptions ?? {}),
      });
      return NextResponse.json(transform?.(token) ?? token);
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

async function getRequestOptions(
  req: Request,
): Promise<AccessTokenRequestOptions | undefined> {
  if (req.method !== 'POST') {
    return undefined;
  }

  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    return undefined;
  }

  const options: AccessTokenRequestOptions = {};
  const scopes = getScopes(body.scopes);

  if (typeof body.refresh === 'boolean') {
    options.refresh = body.refresh;
  }

  if (typeof body.refreshBeforeExpiresIn === 'number') {
    options.refreshBeforeExpiresIn = body.refreshBeforeExpiresIn;
  }

  if (scopes) {
    options.scopes = scopes;
  }

  return options;
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function getScopes(value: unknown): string | Array<string> | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.every((scope) => typeof scope === 'string')
  ) {
    return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

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
