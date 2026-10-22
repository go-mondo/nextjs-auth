import { NextResponse } from 'next/server.js';
import {
  type AccessTokenResult,
  type GetAccessTokenOptions,
  getAccessTokenFactory,
} from '../oauth/access-token';
import { AccessTokenError, AccessTokenErrorCode } from '../errors/access-token';
import { ConfigError } from '../errors/config';
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
  'refresh' | 'refreshBeforeExpiresIn' | 'resource' | 'scopes'
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
 * POST requests may provide `refresh`, `refreshBeforeExpiresIn`, `resource`,
 * and `scopes` as JSON body options. Omitted body fields keep the static
 * handler options. A malformed `resource` is answered with 400
 * `ERR_INVALID_REQUEST` rather than ignored, because ignoring it would return
 * a token for a different resource.
 *
 * @param instance - Validated auth client instance.
 */
export const accessTokenHandlerFactory =
  <UserClaims extends Claims>(instance: MondoInstance): AccessTokenHandler =>
  (options?: AccessTokenOptions) => {
    assertStaticResource(options?.resource);

    return async (req: Request): Promise<Response> => {
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

  if ('resource' in body) {
    const resource = getResourceError(body.resource);
    if (resource.error) {
      throw new AccessTokenError(
        AccessTokenErrorCode.INVALID_REQUEST,
        resource.error,
      );
    }

    options.resource = resource.value;
  }

  return options;
}

/**
 * Validates an RFC 8707 resource indicator: an absolute `https:` URL (or
 * `http:` for localhost) without a fragment.
 */
function getResourceError(
  value: unknown,
): { value: string; error?: undefined } | { value?: undefined; error: string } {
  if (typeof value !== 'string') {
    return { error: 'The resource must be a string.' };
  }

  // URL parsing strips whitespace and tolerates a missing `//`, so check the
  // raw value that is sent to the token endpoint.
  if (/\s/.test(value) || hasControlCharacter(value)) {
    return {
      error: 'The resource must not contain whitespace or control characters.',
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: 'The resource must be an absolute URL.' };
  }

  const isLocalDevelopment =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (
    !/^https?:\/\//i.test(value) ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && isLocalDevelopment))
  ) {
    return { error: 'The resource must be an https URL.' };
  }

  if (value.includes('#')) {
    return { error: 'The resource must not include a fragment.' };
  }

  return { value };
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

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }

  return false;
}

function assertStaticResource(resource: string | undefined) {
  if (resource === undefined) {
    return;
  }

  const { error } = getResourceError(resource);
  if (error) {
    throw new ConfigError([
      { message: error, path: ['accessTokenHandler', 'resource'] },
    ]);
  }
}

function getStatusCode(code: AccessTokenErrorCode): number {
  switch (code) {
    case AccessTokenErrorCode.INVALID_REQUEST:
      return 400;
    case AccessTokenErrorCode.MISSING_SESSION:
    case AccessTokenErrorCode.MISSING_ACCESS_TOKEN:
    case AccessTokenErrorCode.MISSING_REFRESH_TOKEN:
    case AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN:
    case AccessTokenErrorCode.INVALID_REFRESH_TOKEN:
      return 401;
    case AccessTokenErrorCode.INSUFFICIENT_SCOPE:
    case AccessTokenErrorCode.INVALID_TARGET:
      return 403;
    case AccessTokenErrorCode.FAILED_REFRESH_GRANT:
      return 502;
    case AccessTokenErrorCode.FAILED_SESSION_UPDATE:
      return 500;
  }
}
