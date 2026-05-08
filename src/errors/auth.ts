function appendCause(errorMessage: string, cause?: Error): string {
  if (!cause) return errorMessage;
  const separator = errorMessage.endsWith('.') ? '' : '.';
  return `${errorMessage}${separator} CAUSE: ${cause.message}`;
}

type AuthErrorOptions = {
  code: string;
  message: string;
  name: string;
  cause?: Error;
  status?: number;
};

/**
 * The base class for all SDK errors.
 *
 * Subclasses expose stable machine-readable codes for application-level error
 * handling.
 */
export abstract class AuthError extends Error {
  /**
   * A machine-readable error code that remains stable within a major version of the SDK. You
   * should rely on this error code to handle errors. In contrast, the error message is not part of
   * the API and can change anytime. Do **not** parse or otherwise rely on the error message to
   * handle errors.
   */
  public readonly code: string;

  /**
   * The error class name.
   */
  public readonly name: string;

  /**
   * The underlying error, if any.
   *
   * **IMPORTANT** When this error is from the Identity Provider ({@link IdentityProviderError}) it can contain user
   * input and is only escaped using basic escaping for putting untrusted data directly into the HTML body.
   *
   * You should **not** render this error without using a templating engine that will properly escape it for other
   * HTML contexts first.
   */
  public readonly cause?: Error;

  /**
   * The HTTP status code, if any.
   */
  public readonly status?: number;

  /**
   * @param options - Error metadata used by SDK-specific subclasses.
   */
  constructor(options: AuthErrorOptions) {
    /* c8 ignore next */
    super(appendCause(options.message, options.cause));
    this.code = options.code;
    this.name = options.name;
    this.cause = options.cause;
    this.status = options.status;
  }
}
