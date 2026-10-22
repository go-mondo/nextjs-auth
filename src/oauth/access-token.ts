import { AccessTokenError, AccessTokenErrorCode } from '../errors/access-token';
import type { MondoInstance } from '../core/instance';
import type { Session } from '../session/model';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type { Claims, SessionAuthorization } from '../session/types';
import { epoch } from '../session/utils';
import { discoverOIDC } from './oidc';
import { queueRefreshGrant } from './refresh-grant-queue';

/**
 * Seconds a resource token is treated as valid when the identity provider does
 * not return `expires_in`.
 */
const DEFAULT_RESOURCE_TOKEN_LIFETIME = 300;

export type AccessTokenResult = {
  /** Bearer token value returned by the identity provider. */
  accessToken: string;

  /** Epoch seconds when the access token expires. */
  expiresAt: number;

  /** Space-delimited scopes granted to the access token. */
  scope?: string;

  /** Token type returned by the identity provider, usually `Bearer`. */
  type?: string;

  /** RFC 8707 resource the access token was requested for, when one was. */
  resource?: string;
};

export type GetAccessTokenOptions = {
  /**
   * Refresh even when the current access token is still valid.
   */
  refresh?: boolean;

  /**
   * Required scopes for the returned access token.
   */
  scopes?: string | Array<string>;

  /**
   * Number of seconds before expiry that should be treated as already expired.
   */
  refreshBeforeExpiresIn?: number;

  /**
   * RFC 8707 resource indicator to request the access token for.
   *
   * A token for a resource is always obtained with a refresh grant and is not
   * stored in the session; the session keeps the sign-in access token.
   */
  resource?: string;
};

export type GetAccessToken = (
  options?: GetAccessTokenOptions,
) => Promise<AccessTokenResult>;

/**
 * Creates a server-side access-token getter bound to one auth client instance.
 *
 * The getter returns the current sealed-cookie access token when it is valid for
 * the requested scopes. If it is expired, explicitly refreshed, or missing the
 * requested scopes, the getter uses the stored refresh token and persists the
 * refreshed authorization payload back to the session cookies.
 *
 * When a `resource` is requested, the getter always refreshes and returns the
 * new token without storing it. Only a rotated refresh token is persisted.
 *
 * @param instance - Validated auth client instance.
 */
export function getAccessTokenFactory<UserClaims extends Claims>(
  instance: MondoInstance,
): GetAccessToken {
  return async (options = {}) => {
    const sessionStore = sessionStoreFactory<UserClaims>(instance.config);
    const session = await sessionStore.get();

    if (!session?.user) {
      throw new AccessTokenError(
        AccessTokenErrorCode.MISSING_SESSION,
        'A session is required to get an access token.',
      );
    }

    const authorization = session.authorization;
    if (!authorization?.accessToken) {
      throw new AccessTokenError(
        AccessTokenErrorCode.MISSING_ACCESS_TOKEN,
        'The session does not contain an access token.',
      );
    }

    if (canUseAccessToken(authorization, options)) {
      return toAccessTokenResult(authorization);
    }

    if (!authorization.refreshToken) {
      throw new AccessTokenError(
        options.resource !== undefined
          ? AccessTokenErrorCode.MISSING_REFRESH_TOKEN
          : isExpired(authorization, options)
            ? AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN
            : AccessTokenErrorCode.INSUFFICIENT_SCOPE,
        'The access token cannot be refreshed because the session does not contain a refresh token.',
      );
    }

    return refreshAccessToken(instance, session, options);
  };
}

async function refreshAccessToken<UserClaims extends Claims>(
  instance: MondoInstance,
  session: Session<UserClaims>,
  options: GetAccessTokenOptions,
): Promise<AccessTokenResult> {
  const authorization = session.authorization;

  if (!authorization?.refreshToken) {
    throw new AccessTokenError(
      AccessTokenErrorCode.MISSING_REFRESH_TOKEN,
      'The session does not contain a refresh token.',
    );
  }

  const { tokens, refreshToken } = await runRefreshGrant(
    instance,
    authorization.refreshToken,
    options,
  );

  const refreshedAuthorization: SessionAuthorization = {
    accessToken: tokens.access_token,
    expiresAt:
      epoch() +
      Number(
        tokens.expires_in ??
          (options.resource !== undefined
            ? DEFAULT_RESOURCE_TOKEN_LIFETIME
            : authorization.expiresAt - epoch()),
      ),
    scope:
      tokens.scope ?? normalizeScopes(options.scopes) ?? authorization.scope,
    refreshToken,
    type: tokens.token_type ?? authorization.type,
  };

  if (options.resource !== undefined) {
    // Resource tokens are not stored: the single authorization cookie keeps
    // the sign-in token. Only a rotated refresh token must be persisted.
    if (refreshToken !== authorization.refreshToken) {
      await persistAuthorization(instance, session, {
        ...authorization,
        refreshToken,
      });
    }

    return {
      ...toAccessTokenResult(refreshedAuthorization),
      resource: options.resource,
    };
  }

  await persistAuthorization(instance, session, refreshedAuthorization);

  return toAccessTokenResult(refreshedAuthorization);
}

async function runRefreshGrant(
  instance: MondoInstance,
  storedRefreshToken: string,
  options: GetAccessTokenOptions,
) {
  const oidc = await loadOpenIdClient();

  try {
    const result = await queueRefreshGrant(
      instance,
      storedRefreshToken,
      async (refreshToken) =>
        oidc.refreshTokenGrant(
          await discoverOIDC(instance.config),
          refreshToken,
          getRefreshParameters(options),
        ),
    );

    const accessToken = result.tokens.access_token;
    if (!accessToken) {
      throw new AccessTokenError(
        AccessTokenErrorCode.FAILED_REFRESH_GRANT,
        'The refresh grant did not return an access token.',
      );
    }

    return {
      ...result,
      tokens: { ...result.tokens, access_token: accessToken },
    };
  } catch (error) {
    if (error instanceof AccessTokenError) {
      throw error;
    }

    if (
      error instanceof oidc.ResponseBodyError &&
      error.error === 'invalid_grant'
    ) {
      throw new AccessTokenError(
        AccessTokenErrorCode.INVALID_REFRESH_TOKEN,
        'The refresh token is invalid, expired, or revoked.',
        error,
      );
    }

    if (
      error instanceof oidc.ResponseBodyError &&
      error.error === 'invalid_target'
    ) {
      throw new AccessTokenError(
        AccessTokenErrorCode.INVALID_TARGET,
        'The requested resource is invalid or not available to this session.',
        error,
      );
    }

    throw new AccessTokenError(
      AccessTokenErrorCode.FAILED_REFRESH_GRANT,
      'The refresh grant failed.',
      error instanceof Error ? error : undefined,
    );
  }
}

let openIdClient: Promise<typeof import('openid-client')> | undefined;

/**
 * Loads `openid-client` once and shares the import between concurrent
 * refreshes.
 */
function loadOpenIdClient() {
  openIdClient ??= import('openid-client');
  return openIdClient;
}

async function persistAuthorization<UserClaims extends Claims>(
  instance: MondoInstance,
  session: Session<UserClaims>,
  authorization: SessionAuthorization,
): Promise<void> {
  session.authorization = authorization;

  try {
    await sessionStoreFactory<UserClaims>(instance.config).set(session);
  } catch (error) {
    throw new AccessTokenError(
      AccessTokenErrorCode.FAILED_SESSION_UPDATE,
      'The refreshed authorization could not be saved to the session. Get access tokens where cookies can be set, such as a route handler or server action.',
      error instanceof Error ? error : undefined,
    );
  }
}

function canUseAccessToken(
  authorization: SessionAuthorization,
  options: GetAccessTokenOptions,
): boolean {
  return (
    options.resource === undefined &&
    options.refresh !== true &&
    !isExpired(authorization, options) &&
    hasScopes(authorization.scope, options.scopes)
  );
}

function isExpired(
  authorization: SessionAuthorization,
  options: GetAccessTokenOptions,
): boolean {
  const skew = options.refreshBeforeExpiresIn ?? 60;
  return authorization.expiresAt <= epoch() + skew;
}

function hasScopes(
  grantedScope: string | undefined,
  requiredScopes: string | Array<string> | undefined,
): boolean {
  const required = normalizeScopes(requiredScopes);
  if (!required) {
    return true;
  }

  const granted = new Set((grantedScope ?? '').split(/\s+/).filter(Boolean));
  return required.split(/\s+/).every((scope) => granted.has(scope));
}

function getRefreshParameters(
  options: GetAccessTokenOptions,
): URLSearchParams | undefined {
  const scope = normalizeScopes(options.scopes);
  if (!scope && options.resource === undefined) {
    return undefined;
  }

  const params = new URLSearchParams();
  if (scope) {
    params.set('scope', scope);
  }
  if (options.resource !== undefined) {
    params.set('resource', options.resource);
  }
  return params;
}

function normalizeScopes(scopes: string | Array<string> | undefined) {
  if (Array.isArray(scopes)) {
    return scopes.join(' ');
  }

  return scopes;
}

function toAccessTokenResult(
  authorization: SessionAuthorization,
): AccessTokenResult {
  return {
    accessToken: authorization.accessToken,
    expiresAt: authorization.expiresAt,
    scope: authorization.scope,
    type: authorization.type,
  };
}
