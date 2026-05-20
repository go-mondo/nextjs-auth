import { AuthError } from './auth';

/**
 * Error codes for {@link FetchAccessTokenError}.
 */
export enum FetchAccessTokenErrorCode {
  /** The access-token route returned an error response. */
  REQUEST_FAILED = 'ERR_FETCH_ACCESS_TOKEN_FAILED',
}

/**
 * Error thrown by {@link fetchAccessToken} when the mounted access-token
 * route returns a non-2xx response.
 *
 * Use {@link FetchAccessTokenError.code}, {@link FetchAccessTokenError.status},
 * and {@link FetchAccessTokenError.rawError} to handle the error without
 * parsing the message text.
 */
export class FetchAccessTokenError extends AuthError {
  /**
   * The HTTP status code returned by the access-token route.
   */
  public readonly status: number;

  /**
   * The raw `error` field from the JSON error body, when present.
   */
  public readonly rawError: string | undefined;

  /**
   * @param status - HTTP status code from the access-token route.
   * @param rawError - The `error` field from the JSON body, if present.
   * @param message - Human-readable diagnostic message.
   * @param cause - Optional lower-level error.
   */
  constructor(
    status: number,
    rawError: string | undefined,
    message: string,
    cause?: Error,
  ) {
    super({
      code: FetchAccessTokenErrorCode.REQUEST_FAILED,
      message,
      name: 'FetchAccessTokenError',
      cause,
      status,
    });

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, FetchAccessTokenError.prototype);

    this.status = status;
    this.rawError = rawError;
  }
}
