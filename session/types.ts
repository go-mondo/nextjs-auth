import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextRequest, NextResponse } from 'next/server';

export type AnyRequest =
  | IncomingMessage
  | NextApiRequest
  | NextRequest
  | Request;
export type AnyResponse =
  | ServerResponse
  | NextApiResponse
  | NextResponse
  | Response;

/**
 * Key-value store for the user's claims.
 *
 * @category Server
 */
export interface Claims {
  [key: string]: any;
}

export type IdTokenClaims<ExtraClaims extends Claims = {}> =
  UserProfile<ExtraClaims> & {
    nonce: string;
    iat: number;
    iss: string;
    aud: string;
    exp: number;
  };

export type UserProfile<ExtraClaims extends Claims> = {
  /**
   * The tenant context
   */
  tnt: string;

  /**
   * The user's name
   */
  name?: string;

  /**
   * The user's family / last name
   */
  family_name?: string;

  /**
   * The user's given / first name
   */
  given_name?: string;

  /**
   * The user's primary email address
   */
  email?: string;

  /**
   * Identifies whether the email is verified
   */
  email_verified?: boolean;

  /**
   * The user's primary phone number
   */
  phone_number?: string;

  /**
   * Identifies whether the email is verified
   */
  phone_number_verified?: boolean;
} & ExtraClaims;

export interface BaseSession<UserClaims extends Claims> {
  /**
   * The authenticated user
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
}

export interface SessionAuthentication {
  /**
   * The raw OIDC token
   */
  idToken: string;
}

export interface SessionAuthorization {
  /**
   * An access token used
   */
  accessToken: string;

  /**
   * A space ` ` delimited string of scopes granted to the access token
   */
  accessTokenScope?: string | undefined;

  /**
   * A timestamp when the access token will expire
   */
  accessTokenExpiresAt: number;

  /**
   * A refresh token, used to obtain a new access token.
   *
   * This token is only populated if the `refresh_token` scope is requested
   */
  refreshToken?: string | undefined;

  /**
   * The type of access token ('bearer')
   */
  accessTokenType?: string | undefined;
}

export type SessionPart<UserClaims extends Claims = {}> =
  | BaseSession<UserClaims>
  | SessionAuthentication
  | SessionAuthorization;
