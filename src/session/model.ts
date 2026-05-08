import type { TokenEndpointResponse } from '../oidc/types';
import type {
  BaseSession,
  Claims,
  IdTokenClaims,
  SessionAuthentication,
  SessionAuthorization,
  UserProfile,
} from './types';

export type SerializedSession<UserClaims extends Claims = Claims> =
  BaseSession<UserClaims> & {
    authentication?: SessionAuthentication;
    authorization?: SessionAuthorization;
  };

/**
 * The user's session.
 *
 * The public session shape combines the base user claims cookie with optional
 * authentication and authorization cookies.
 *
 * @category Server
 */
export class Session<UserClaims extends Claims = Claims>
  implements BaseSession<UserClaims>
{
  /**
   * The authenticated user (claims from the `id_token`)
   */
  user: UserProfile<UserClaims>;

  /**
   * A timestamp when authentication / session occurred
   */
  issuedAt: number;

  /**
   * A timestamp when authentication / session was last updated (touched)
   */
  updatedAt: number;

  /**
   * A timestamp when the authentication / session is set to expire
   */
  expiresAt: number;

  authorization?: SessionAuthorization;

  authentication?: SessionAuthentication;

  [key: string]: any;

  /**
   * Creates a normalized session object from sealed cookie payloads.
   */
  constructor(props: SerializedSession<UserClaims>) {
    this.user = props.user;
    this.issuedAt = props.issuedAt;
    this.updatedAt = props.updatedAt;
    this.expiresAt = props.expiresAt;
    this.authentication = props.authentication;
    this.authorization = props.authorization;
  }
}

/**
 * Converts an OIDC token endpoint response into the session model stored in
 * sealed cookies.
 *
 * @param tokenEndpointResponse - Token endpoint response returned by
 * `openid-client`.
 */
export function fromTokenEndpointResponse<UserClaims extends Claims = Claims>(
  tokenEndpointResponse: TokenEndpointResponse,
): Session<UserClaims> {
  const { iat, exp, aud, iss, nonce, ...user } = decodeJwt<IdTokenClaims>(
    tokenEndpointResponse.id_token as string,
  );

  const {
    id_token,
    access_token,
    scope,
    expires_in,
    expires_at,
    refresh_token,
    token_type,
    ...remainder
  } = tokenEndpointResponse;

  const authorization = access_token
    ? {
        accessToken: access_token,
        accessTokenScope: scope,
        accessTokenExpiresAt:
          Math.floor(Date.now() / 1000) + Number(expires_in),
        refreshToken: refresh_token,
        accessTokenType: token_type,
      }
    : undefined;

  const authentication = id_token
    ? {
        idToken: id_token,
      }
    : undefined;

  return Object.assign(
    new Session({
      user: user as UserProfile<UserClaims>,
      issuedAt: iat,
      updatedAt: iat,
      expiresAt: exp,
      authorization,
      authentication,
    }),
    remainder,
  );
}

function decodeJwt<TClaims>(jwt: string): TClaims {
  const [, payload] = jwt.split('.');

  if (!payload) {
    throw new TypeError('Invalid JWT payload.');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );

  const decoded =
    typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('binary');

  const json = decodeURIComponent(
    Array.from(
      decoded,
      (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
    ).join(''),
  );

  return JSON.parse(json) as TClaims;
}
