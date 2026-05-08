import { AuthError } from './auth';

/**
 * Error shape used by lower-level HTTP libraries.
 */
interface HttpError extends Error {
  status: number;
  statusCode: number;
}

/**
 * Supported causes for route-handler errors.
 */
export type HandlerErrorCause = Error | AuthError | HttpError;

type HandlerErrorOptions = {
  code: string;
  message: string;
  name: string;
  cause: HandlerErrorCause;
};

/**
 * Base class for errors thrown by route handlers.
 */
class HandlerError extends AuthError {
  constructor(options: HandlerErrorOptions) {
    let status: number | undefined;
    if ('status' in options.cause) status = options.cause.status;
    /* c8 ignore next */
    super({ ...options, status });
  }
}

/**
 * Error thrown when callback handling fails.
 */
export class CallbackHandlerError extends HandlerError {
  public static readonly code: string = 'ERR_CALLBACK_HANDLER_FAILURE';

  constructor(cause: HandlerErrorCause) {
    super({
      code: CallbackHandlerError.code,
      message: 'Callback handler failed.',
      name: 'CallbackHandlerError',
      cause,
    }); /* c8 ignore next */
    Object.setPrototypeOf(this, CallbackHandlerError.prototype);
  }
}

/**
 * Error thrown when login handling fails.
 */
export class LoginHandlerError extends HandlerError {
  public static readonly code: string = 'ERR_LOGIN_HANDLER_FAILURE';

  constructor(cause: HandlerErrorCause) {
    super({
      code: LoginHandlerError.code,
      message: 'Login handler failed.',
      name: 'LoginHandlerError',
      cause,
    }); /* c8 ignore next */
    Object.setPrototypeOf(this, LoginHandlerError.prototype);
  }
}

/**
 * Error thrown when logout handling fails.
 */
export class LogoutHandlerError extends HandlerError {
  public static readonly code: string = 'ERR_LOGOUT_HANDLER_FAILURE';

  constructor(cause: HandlerErrorCause) {
    super({
      code: LogoutHandlerError.code,
      message: 'Logout handler failed.',
      name: 'LogoutHandlerError',
      cause,
    }); /* c8 ignore next */
    Object.setPrototypeOf(this, LogoutHandlerError.prototype);
  }
}
