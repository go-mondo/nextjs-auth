/**
 * Error used when the callback response is missing a `state` parameter.
 */
export class MissingStateParamError extends Error {
  static message = 'Missing state parameter in Authorization Response.';
  status = 400;
  statusCode = 400;

  constructor() {
    /* c8 ignore next */
    super(MissingStateParamError.message);
    Object.setPrototypeOf(this, MissingStateParamError.prototype);
  }
}

/**
 * Error used when the callback response state does not match the login
 * transaction.
 */
export class MismatchedStateParamError extends Error {
  static message = 'State parameter mismatch in Authorization Response.';
  status = 400;
  statusCode = 400;

  constructor() {
    /* c8 ignore next */
    super(MismatchedStateParamError.message);
    Object.setPrototypeOf(this, MismatchedStateParamError.prototype);
  }
}

/**
 * Error used when transaction state exists but cannot be parsed.
 */
export class MalformedStateCookieError extends Error {
  static message = 'Your state cookie is not valid JSON.';
  status = 400;
  statusCode = 400;

  constructor() {
    /* c8 ignore next */
    super(MalformedStateCookieError.message);
    Object.setPrototypeOf(this, MalformedStateCookieError.prototype);
  }
}

/**
 * Error used when the callback cannot find the login transaction cookie.
 */
export class MissingStateCookieError extends Error {
  static message =
    'Missing state cookie from login request (check login URL, callback URL and cookie config).';
  status = 400;
  statusCode = 400;

  constructor() {
    /* c8 ignore next */
    super(MissingStateCookieError.message);
    Object.setPrototypeOf(this, MissingStateCookieError.prototype);
  }
}
