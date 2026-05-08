import { AccessTokenError, AccessTokenErrorCode } from '../errors/access-token';
import type { MondoInstance } from '../core/instance';
import type { Session } from '../session/model';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type { Claims, SessionAuthorization } from '../session/types';
import { epoch } from '../session/utils';
import { discoverOIDC } from './discovery';

export type AccessTokenResult = {
  /** Bearer token value returned by the identity provider. */
  accessToken: string;

  /** Epoch seconds when the access token expires. */
  accessTokenExpiresAt: number;

  /** Space-delimited scopes granted to the access token. */
  accessTokenScope?: string;

  /** Token type returned by the identity provider, usually `Bearer`. */
  accessTokenType?: string;
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
        isExpired(authorization, options)
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
  const oidc = await import('openid-client');
  const authorization = session.authorization;

  if (!authorization?.refreshToken) {
    throw new AccessTokenError(
      AccessTokenErrorCode.MISSING_REFRESH_TOKEN,
      'The session does not contain a refresh token.',
    );
  }

  try {
    const params = getRefreshParameters(options);
    const tokens = await oidc.refreshTokenGrant(
      await discoverOIDC(instance.config),
      authorization.refreshToken,
      params,
    );

    if (!tokens.access_token) {
      throw new AccessTokenError(
        AccessTokenErrorCode.FAILED_REFRESH_GRANT,
        'The refresh grant did not return an access token.',
      );
    }

    const refreshedAuthorization: SessionAuthorization = {
      accessToken: tokens.access_token,
      accessTokenExpiresAt:
        epoch() +
        Number(
          tokens.expires_in ?? authorization.accessTokenExpiresAt - epoch(),
        ),
      accessTokenScope:
        tokens.scope ??
        normalizeScopes(options.scopes) ??
        authorization.accessTokenScope,
      refreshToken: tokens.refresh_token ?? authorization.refreshToken,
      accessTokenType: tokens.token_type ?? authorization.accessTokenType,
    };

    session.authorization = refreshedAuthorization;
    await sessionStoreFactory<UserClaims>(instance.config).set(session);

    return toAccessTokenResult(refreshedAuthorization);
  } catch (error) {
    if (error instanceof AccessTokenError) {
      throw error;
    }

    throw new AccessTokenError(
      AccessTokenErrorCode.FAILED_REFRESH_GRANT,
      'The refresh grant failed.',
      error instanceof Error ? error : undefined,
    );
  }
}

function canUseAccessToken(
  authorization: SessionAuthorization,
  options: GetAccessTokenOptions,
): boolean {
  return (
    options.refresh !== true &&
    !isExpired(authorization, options) &&
    hasScopes(authorization.accessTokenScope, options.scopes)
  );
}

function isExpired(
  authorization: SessionAuthorization,
  options: GetAccessTokenOptions,
): boolean {
  const skew = options.refreshBeforeExpiresIn ?? 60;
  return authorization.accessTokenExpiresAt <= epoch() + skew;
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
  if (!scope) {
    return undefined;
  }

  const params = new URLSearchParams();
  params.set('scope', scope);
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
    accessTokenExpiresAt: authorization.accessTokenExpiresAt,
    accessTokenScope: authorization.accessTokenScope,
    accessTokenType: authorization.accessTokenType,
  };
}
