import * as jose from 'jose';
import type { TokenEndpointResponse } from '../types';
import type {
  BaseSession,
  Claims,
  IdTokenClaims,
  SessionAuthentication,
  SessionAuthorization,
  UserProfile,
} from './types';

export type SerializedSession<UserClaims extends Claims = {}> =
  BaseSession<UserClaims> & {
    authentication?: SessionAuthentication;
    authorization?: SessionAuthorization;
  };

/**
 * The user's session.
 *
 * @category Server
 */
export default class Session<UserClaims extends Claims = {}>
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

  /**
   *
   */
  authorization?: SessionAuthorization;

  /**
   *
   */
  authentication?: SessionAuthentication;

  [key: string]: any;

  constructor(props: SerializedSession<UserClaims>) {
    this.user = props.user;
    this.issuedAt = props.issuedAt;
    this.updatedAt = props.updatedAt;
    this.expiresAt = props.expiresAt;
    (this.authentication = props.authentication),
      (this.authorization = props.authorization);
  }
}

export function fromTokenEndpointResponse<UserClaims extends Claims = {}>(
  tokenEndpointResponse: TokenEndpointResponse
): Session<UserClaims> {
  // Get the claims without any OIDC-specific claim.
  const { iat, exp, aud, iss, nonce, ...user } = jose.decodeJwt<IdTokenClaims>(
    tokenEndpointResponse.id_token as string
  );

  // Get other response data
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
    remainder
  );
}

// /**
//  * @ignore
//  */
// export function fromJson(session: SerializedSession | undefined): Session | null {
//   if (!session) {
//     return null;
//   }

//   const {
//     user,
//     issuedAt,
//     updatedAt,
//     expiresAt,
//     // Authorization
//     accessToken,
//     accessTokenScope,
//     accessTokenExpiresAt,
//     refreshToken,
//     accessTokenType,
//     // Authentication
//     idToken,
//     ...remainder
//   } = session

//   return Object.assign(
//     new Session({
//       user,
//       issuedAt,
//       updatedAt,
//       expiresAt,
//       // Authorization
//       accessToken,
//       accessTokenScope,
//       accessTokenExpiresAt,
//       refreshToken,
//       accessTokenType,
//       // Authentication
//       idToken,
//     }),
//     remainder
//   );
// }
