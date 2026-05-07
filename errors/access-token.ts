import { AuthError } from './auth';

/**
 * Error codes for {@link AccessTokenError}.
 *
 * @category Server
 */
export enum AccessTokenErrorCode {
  MISSING_SESSION = 'ERR_MISSING_SESSION',
  MISSING_ACCESS_TOKEN = 'ERR_MISSING_ACCESS_TOKEN',
  MISSING_REFRESH_TOKEN = 'ERR_MISSING_REFRESH_TOKEN',
  EXPIRED_ACCESS_TOKEN = 'ERR_EXPIRED_ACCESS_TOKEN',
  INSUFFICIENT_SCOPE = 'ERR_INSUFFICIENT_SCOPE',
  FAILED_REFRESH_GRANT = 'ERR_FAILED_REFRESH_GRANT',
}

/**
 * The error thrown by {@link GetAccessToken}.
 *
 * @see the {@link AuthError.code | code property} contains a machine-readable error code that
 * remains stable within a major version of the SDK. You should rely on this error code to handle
 * errors. In contrast, the error message is not part of the API and can change anytime. Do **not**
 * parse or otherwise rely on the error message to handle errors.
 *
 * @see {@link AccessTokenErrorCode} for the list of all possible error codes.
 * @category Server
 */
export class AccessTokenError extends AuthError {
  constructor(code: AccessTokenErrorCode, message: string, cause?: Error) {
    /* c8 ignore next */
    super({ code: code, message: message, name: 'AccessTokenError', cause });

    // Capturing stack trace, excluding constructor call from it.
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AccessTokenError.prototype);
  }
}
