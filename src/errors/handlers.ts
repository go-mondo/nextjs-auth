import { AuthError } from './auth';

/**
 * @ignore
 */
interface HttpError extends Error {
  status: number;
  statusCode: number;
}

/**
 * @ignore
 */
export type HandlerErrorCause = Error | AuthError | HttpError;

type HandlerErrorOptions = {
  code: string;
  message: string;
  name: string;
  cause: HandlerErrorCause;
};

/**
 * The base class for errors thrown by API route handlers. It extends {@link AuthError}.
 *
 * Because part of the error message can come from the OpenID Connect `error` query parameter we
 * do some basic escaping which makes sure the default error handler is safe from XSS.
 *
 * **IMPORTANT** If you write your own error handler, you should **not** render the error message
 * without using a templating engine that will properly escape it for other HTML contexts first.
 *
 * @see the {@link AuthError.cause | cause property} contains the underlying error.
 * **IMPORTANT** When this error is from the Identity Provider ({@link IdentityProviderError}) it can contain user
 * input and is only escaped using basic escaping for putting untrusted data directly into the HTML body.
 * You should **not** render this error without using a templating engine that will properly escape it for other
 * HTML contexts first.
 *
 * @see the {@link AuthError.status | status property} contains the HTTP status code of the error,
 * if any.
 *
 * @category Server
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
 * The error thrown by the callback API route handler. It extends {@link HandlerError}.
 *
 * Because part of the error message can come from the OpenID Connect `error` query parameter we
 * do some basic escaping which makes sure the default error handler is safe from XSS.
 *
 * **IMPORTANT** If you write your own error handler, you should **not** render the error message
 * without using a templating engine that will properly escape it for other HTML contexts first.
 *
 * @see the {@link AuthError.cause | cause property} contains the underlying error.
 * **IMPORTANT** When this error is from the Identity Provider ({@link IdentityProviderError}) it can contain user
 * input and is only escaped using basic escaping for putting untrusted data directly into the HTML body.
 * You should **not** render this error without using a templating engine that will properly escape it for other
 * HTML contexts first.
 *
 * @see the {@link AuthError.status | status property} contains the HTTP status code of the error,
 * if any.
 *
 * @category Server
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
 * The error thrown by the login API route handler. It extends {@link HandlerError}.
 *
 * @see the {@link AuthError.cause | cause property} contains the underlying error.
 * @category Server
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
 * The error thrown by the logout API route handler. It extends {@link HandlerError}.
 *
 * @see the {@link AuthError.cause | cause property} contains the underlying error.
 * @category Server
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

/**
 * The error thrown by the profile API route handler. It extends {@link HandlerError}.
 *
 * @see the {@link AuthError.cause | cause property} contains the underlying error.
 * @category Server
 */
export class ProfileHandlerError extends HandlerError {
  public static readonly code: string = 'ERR_PROFILE_HANDLER_FAILURE';

  constructor(cause: HandlerErrorCause) {
    super({
      code: ProfileHandlerError.code,
      message: 'Profile handler failed.',
      name: 'ProfileHandlerError',
      cause,
    }); /* c8 ignore next */
    Object.setPrototypeOf(this, ProfileHandlerError.prototype);
  }
}
