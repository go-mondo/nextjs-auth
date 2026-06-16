import { getPublicLoginRoute } from '../config/routes';

/**
 * Options for building or performing a login redirect.
 */
export type LoginRedirectOptions = {
  /**
   * Route to redirect to after a successful login. Defaults to the current
   * browser app path plus query string.
   */
  returnTo?: string;

  /**
   * Navigation mode. When `true`, replaces the current history entry instead
   * of pushing a new one. Defaults to `false`.
   */
  replace?: boolean;
};

/**
 * Error thrown when a login redirect cannot be performed in the current
 * environment (e.g. server-side rendering or a test runner without
 * `window`).
 */
export class LoginRedirectError extends Error {
  public readonly name = 'LoginRedirectError';
}

/**
 * Module-level guard against duplicate redirects from concurrent
 * access-token failures in the same browser runtime.
 */
let isRedirectingToLogin = false;

/**
 * Base URL used only to let the platform URL parser resolve app-relative login
 * routes. This value must never be exposed in returned redirect URLs.
 */
const URL_PARSE_BASE = 'https://nextjs-auth.local';

/**
 * Builds the login URL with a `returnTo` query parameter that encodes the
 * current app path and query string.
 *
 * When `returnTo` is not provided, the helper defaults to
 * `window.location.pathname + window.location.search`. It does **not** use
 * the failed access-token API URL as the return target.
 *
 * In non-browser environments (server components, Node, test runners) the
 * helper returns a URL with `returnTo` set to `'/'` and logs a warning when
 * `console.warn` is available, so consumers can decide how to proceed.
 *
 * Relative login route configuration returns an app-relative URL. Absolute
 * login route configuration keeps its configured origin intact.
 *
 * @param options - Optional `returnTo` and `replace` flags.
 * @returns The login URL as a string.
 */
export function buildLoginUrl(options: LoginRedirectOptions = {}): string {
  const { returnTo } = options;
  const route = getPublicLoginRoute();
  const url = new URL(route, URL_PARSE_BASE);

  if (returnTo !== undefined) {
    url.searchParams.set('returnTo', returnTo);
  } else if (typeof window !== 'undefined' && window.location) {
    url.searchParams.set(
      'returnTo',
      window.location.pathname + window.location.search,
    );
  } else {
    url.searchParams.set('returnTo', '/');
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(
        '@go-mondo/nextjs-auth: buildLoginUrl called outside the browser; `returnTo` defaults to `/`. Pass an explicit `returnTo` to avoid an unconditional redirect after login.',
      );
    }
  }

  return isAbsoluteUrl(route)
    ? url.toString()
    : `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Returns whether a configured login route already includes an origin.
 *
 * @param value - Login route value from public configuration.
 * @returns `true` when `value` is an absolute URL.
 */
function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Redirects the browser to the login page and back to the current app path
 * after a successful login.
 *
 * In non-browser environments (server components, Node, test runners) the
 * helper throws a {@link LoginRedirectError} with a clear diagnostic message.
 *
 * The helper guards against duplicate redirects from concurrent access-token
 * failures by checking a module-level flag before navigating.
 *
 * @param options - Optional `returnTo` and `replace` flags.
 * @throws {@link LoginRedirectError} when called outside the browser.
 */
export async function redirectToLogin(
  options: LoginRedirectOptions = {},
): Promise<void> {
  if (isRedirectingToLogin) {
    return;
  }

  if (typeof window === 'undefined' || !window.location) {
    throw new LoginRedirectError(
      'redirectToLogin can only be called from browser code.',
    );
  }

  const { replace, ...buildOptions } = options;
  const url = buildLoginUrl(buildOptions);

  isRedirectingToLogin = true;

  if (replace) {
    window.location.replace(url);
  } else {
    window.location.assign(url);
  }

  // Clear the guard when the new page loads (the login page).
  window.addEventListener(
    'load',
    () => {
      isRedirectingToLogin = false;
    },
    { once: true },
  );
}
