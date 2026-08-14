import { AuthError } from './auth';

/**
 * Error codes for {@link AccessTokenError}.
 */
export enum AccessTokenErrorCode {
  /** No valid session was available. */
  MISSING_SESSION = 'ERR_MISSING_SESSION',

  /** Session exists but does not contain an access token. */
  MISSING_ACCESS_TOKEN = 'ERR_MISSING_ACCESS_TOKEN',

  /** Refresh was required but no refresh token was stored. */
  MISSING_REFRESH_TOKEN = 'ERR_MISSING_REFRESH_TOKEN',

  /** Access token is expired and cannot be returned as-is. */
  EXPIRED_ACCESS_TOKEN = 'ERR_EXPIRED_ACCESS_TOKEN',

  /** Access token does not include the requested scopes. */
  INSUFFICIENT_SCOPE = 'ERR_INSUFFICIENT_SCOPE',

  /** The authorization server rejected the stored refresh token. */
  INVALID_REFRESH_TOKEN = 'ERR_INVALID_REFRESH_TOKEN',

  /** Refresh token grant failed or returned an invalid response. */
  FAILED_REFRESH_GRANT = 'ERR_FAILED_REFRESH_GRANT',
}

/**
 * Error thrown when an access token cannot be returned or refreshed.
 *
 * Use {@link AccessTokenError.code} for stable error handling.
 */
export class AccessTokenError extends AuthError {
  /**
   * @param code - Stable machine-readable error code.
   * @param message - Human-readable diagnostic message.
   * @param cause - Optional lower-level error.
   */
  constructor(code: AccessTokenErrorCode, message: string, cause?: Error) {
    /* c8 ignore next */
    super({ code: code, message: message, name: 'AccessTokenError', cause });

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AccessTokenError.prototype);
  }
}
