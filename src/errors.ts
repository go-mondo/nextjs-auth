/**
 * Public SDK error types.
 */

export { AccessTokenError, AccessTokenErrorCode } from './errors/access-token';
export { AuthError } from './errors/auth';
export {
  FetchAccessTokenError,
  FetchAccessTokenErrorCode,
} from './errors/client';
export type { ConfigIssue, ConfigIssuePathSegment } from './errors/config';
export { ConfigError } from './errors/config';
export type { HandlerErrorCause } from './errors/handlers';
export {
  CallbackHandlerError,
  LoginHandlerError,
  LogoutHandlerError,
} from './errors/handlers';
export {
  MalformedStateCookieError,
  MismatchedStateParamError,
  MissingStateCookieError,
  MissingStateParamError,
} from './errors/state';
