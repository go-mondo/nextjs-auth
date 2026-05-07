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
