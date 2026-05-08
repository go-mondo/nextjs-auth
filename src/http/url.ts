import type { Config } from '../config/types';

/**
 * Returns a same-origin redirect target or `undefined`.
 *
 * @param dangerousRedirect - Untrusted path or URL from a request.
 * @param safeBaseUrl - Origin that redirects must stay within.
 */
export function toSafeRedirect(
  dangerousRedirect: string,
  safeBaseUrl: URL,
): string | undefined {
  let url: URL;
  try {
    url = new URL(dangerousRedirect, safeBaseUrl);
  } catch (_e) {
    return undefined;
  }
  if (url.origin === safeBaseUrl.origin) {
    return url.toString();
  }
  return undefined;
}

/**
 * Builds the redirect URI sent to the identity provider.
 *
 * @param config - Validated auth configuration.
 * @param origin - Optional request origin used for preview deployments and
 * multi-host apps.
 */
export function getAuthorizationRedirectURL(
  config: Config,
  origin?: string,
): URL {
  return pathOrURLToURL(config, config.routes.callback, origin);
}

/**
 * Converts either an absolute URL or application path into a URL object.
 *
 * Relative paths resolve against the request origin when provided, otherwise
 * against the configured base URL.
 */
export function pathOrURLToURL(
  config: Config,
  pathOrUrl: string | URL,
  origin?: string,
): URL {
  if (pathOrUrl instanceof URL) {
    return pathOrUrl;
  }

  try {
    return new URL(pathOrUrl);
  } catch (_) {
    return new URL(joinURL(origin || config.baseURL, pathOrUrl));
  }
}

function joinURL(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
