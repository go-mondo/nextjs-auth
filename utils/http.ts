import urlJoin from "url-join";
import type { Config } from "../config/types";

/**
 * Helper which tests if a URL can safely be redirected to. Requires the URL to be relative.
 *
 * @param dangerousRedirect
 * @param safeBaseUrl
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
 *
 * @param config
 * @returns
 */
export function getAuthorizationRedirectURL(
  config: Config,
  origin?: string,
): URL {
  return pathOrURLToURL(config, config.routes.callback, origin);
}

/** */
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
    return new URL(urlJoin(origin || config.baseURL, pathOrUrl));
  }
}
