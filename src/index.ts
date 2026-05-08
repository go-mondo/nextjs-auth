/**
 * Public package entrypoint.
 *
 * Prefer creating one auth client with {@link createAuth} and reusing it from
 * route handlers, server code, and `proxy.ts`.
 */
export { createAuth, MondoAuthClient } from './client';
export type {
  HandleAuthOptions,
  ProxyOptions,
} from './client';
export type {
  AccessTokenResult,
  GetAccessTokenOptions,
} from './oidc/access-token';
export type { Config, PartialConfig } from './config/types';
export type { Claims, UserProfile } from './session/types';
