/**
 * Public SDK error types.
 */
export { AuthError } from './errors/auth';
export { AccessTokenError, AccessTokenErrorCode } from './errors/access-token';
export { ConfigError } from './errors/config';
export type { ConfigIssue, ConfigIssuePathSegment } from './errors/config';
export {
  CallbackHandlerError,
  LoginHandlerError,
  LogoutHandlerError,
} from './errors/handlers';
export type { HandlerErrorCause } from './errors/handlers';
export {
  MalformedStateCookieError,
  MissingStateCookieError,
  MissingStateParamError,
} from './errors/state';
