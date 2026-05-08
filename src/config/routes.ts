/**
 * Built-in auth route defaults used by both server configuration and
 * browser-safe client helpers.
 */
export const DEFAULT_ROUTES = {
  login: '/auth/login',
  callback: '/auth/callback',
  logout: '/auth/logout',
  session: '/auth/session',
  accessToken: '/auth/access-token',
  postLogoutRedirect: '/',
} as const;

/**
 * Returns the session route that browser code can safely call.
 *
 * The full server configuration reads secret-bearing environment variables, so
 * client hooks use the public session route override instead.
 */
export function getPublicSessionRoute(): string {
  return typeof process === 'undefined'
    ? DEFAULT_ROUTES.session
    : process.env.NEXT_PUBLIC_MONDO_SESSION || DEFAULT_ROUTES.session;
}
