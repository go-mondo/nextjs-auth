import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { getPublicAccessTokenRoute } from '../config/routes';
import type {
  AccessTokenResult,
  GetAccessTokenOptions,
} from '../oauth/access-token';

/**
 * Options for fetching an access token from browser code.
 */
export type FetchAccessTokenOptions = GetAccessTokenOptions & {
  /**
   * Mounted access-token route. Defaults to `/auth/access-token`.
   */
  route?: string;

  /**
   * Additional fetch options merged with `credentials: "same-origin"`.
   */
  request?: RequestInit;
};

/**
 * Access-token provider for imperative browser API clients.
 */
export type AccessTokenProvider = {
  /**
   * Returns a cached access token when it is still fresh, otherwise calls the
   * mounted access-token route and stores the result.
   */
  getAccessToken: (
    options?: FetchAccessTokenOptions,
  ) => Promise<AccessTokenResult>;

  /**
   * Clears the cached entry for the provided route and scopes. Clears every
   * cached entry when no options are provided.
   */
  clear: (options?: Pick<FetchAccessTokenOptions, 'route' | 'scopes'>) => void;

  /**
   * Clears every cached entry.
   */
  clearAll: () => void;
};

/**
 * Default TanStack Query key used by {@link useAccessToken}.
 */
export type UseAccessTokenQueryKey = readonly [
  'mondo-auth',
  'access-token',
  string,
  string | undefined,
  boolean | undefined,
  number | undefined,
];

/**
 * Options accepted by {@link useAccessToken}.
 *
 * All normal TanStack Query options are supported except `queryFn` and
 * `queryKey`, which are owned by the hook. Pass `queryKey` here to override the
 * default key.
 */
export type UseAccessTokenOptions<
  TData = AccessTokenResult,
  TQueryKey extends QueryKey = UseAccessTokenQueryKey,
> = FetchAccessTokenOptions &
  Omit<
    UseQueryOptions<AccessTokenResult, Error, TData, TQueryKey>,
    'queryFn' | 'queryKey'
  > & {
    /**
     * TanStack Query key. Defaults to route, scopes, refresh, and refresh skew.
     */
    queryKey?: TQueryKey;
  };

/**
 * Fetches a current access token from the mounted access-token route.
 *
 * The server reads the local sealed session and refreshes the token when
 * needed, when `refresh` is true, or when requested scopes are missing.
 */
export async function fetchAccessToken(
  options: FetchAccessTokenOptions = {},
): Promise<AccessTokenResult> {
  const {
    refresh,
    refreshBeforeExpiresIn,
    request,
    route = getPublicAccessTokenRoute(),
    scopes,
  } = options;
  const body = getRequestBody({ refresh, refreshBeforeExpiresIn, scopes });
  const headers = new Headers(request?.headers);

  if (body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(route, {
    ...request,
    body: body ? JSON.stringify(body) : request?.body,
    credentials: 'same-origin',
    headers,
    method: body ? 'POST' : request?.method,
  });

  if (!response.ok) {
    const message = await getErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as AccessTokenResult;
}

/**
 * Creates an in-memory access-token cache for imperative browser API clients.
 *
 * This is useful when an app needs to make multiple browser-side API calls with
 * a bearer token. Cached tokens are kept only in memory, are refreshed before
 * expiry, and concurrent misses share one `/auth/access-token` request.
 */
export function createAccessTokenProvider(
  defaultOptions: FetchAccessTokenOptions = {},
): AccessTokenProvider {
  const entries = new Map<string, AccessTokenCacheEntry>();

  const loadAccessToken = async (options: FetchAccessTokenOptions) => {
    const key = getAccessTokenCacheKey(options);
    let promise: Promise<AccessTokenResult>;

    promise = fetchAccessToken(options).then(
      (token) => {
        entries.set(key, { token });
        return token;
      },
      (error) => {
        if (entries.get(key)?.promise === promise) {
          entries.delete(key);
        }

        throw error;
      },
    );

    entries.set(key, { promise });
    return promise;
  };

  return {
    getAccessToken(options = {}) {
      const mergedOptions = mergeFetchAccessTokenOptions(
        defaultOptions,
        options,
      );
      const key = getAccessTokenCacheKey(mergedOptions);
      const entry = entries.get(key);

      if (
        mergedOptions.refresh !== true &&
        entry?.token &&
        canUseCachedAccessToken(entry.token, mergedOptions)
      ) {
        return Promise.resolve(entry.token);
      }

      if (mergedOptions.refresh !== true && entry?.promise) {
        return entry.promise;
      }

      return loadAccessToken(mergedOptions);
    },

    clear(options) {
      if (!options) {
        entries.clear();
        return;
      }

      entries.delete(
        getAccessTokenCacheKey(
          mergeFetchAccessTokenOptions(defaultOptions, options),
        ),
      );
    },

    clearAll() {
      entries.clear();
    },
  };
}

/**
 * TanStack Query hook for a current access token.
 *
 * Apps must provide a `QueryClientProvider` above this hook. The hook calls the
 * app's local access-token endpoint; refresh tokens never leave the server.
 */
export function useAccessToken<
  TData = AccessTokenResult,
  TQueryKey extends QueryKey = UseAccessTokenQueryKey,
>(
  options: UseAccessTokenOptions<TData, TQueryKey> = {},
): UseQueryResult<TData, Error> {
  const {
    queryKey,
    refresh,
    refreshBeforeExpiresIn,
    request,
    route = getPublicAccessTokenRoute(),
    scopes,
    ...queryOptions
  } = options;

  return useQuery({
    queryKey:
      queryKey ??
      ([
        'mondo-auth',
        'access-token',
        route,
        normalizeScopes(scopes),
        refresh,
        refreshBeforeExpiresIn,
      ] satisfies UseAccessTokenQueryKey),
    queryFn: () =>
      fetchAccessToken({
        refresh,
        refreshBeforeExpiresIn,
        request,
        route,
        scopes,
      }),
    ...queryOptions,
  } as UseQueryOptions<AccessTokenResult, Error, TData, TQueryKey>);
}

function getRequestBody(options: GetAccessTokenOptions) {
  if (
    options.refresh === undefined &&
    options.refreshBeforeExpiresIn === undefined &&
    options.scopes === undefined
  ) {
    return undefined;
  }

  return options;
}

type AccessTokenCacheEntry = {
  token?: AccessTokenResult;
  promise?: Promise<AccessTokenResult>;
};

function mergeFetchAccessTokenOptions(
  defaultOptions: FetchAccessTokenOptions,
  options: FetchAccessTokenOptions,
): FetchAccessTokenOptions {
  const request = mergeRequestInit(defaultOptions.request, options.request);

  return {
    ...defaultOptions,
    ...options,
    request,
  };
}

function mergeRequestInit(
  defaultRequest: RequestInit | undefined,
  request: RequestInit | undefined,
): RequestInit | undefined {
  if (!defaultRequest && !request) {
    return undefined;
  }

  return {
    ...defaultRequest,
    ...request,
    headers: mergeHeaders(defaultRequest?.headers, request?.headers),
  };
}

function mergeHeaders(
  defaultHeaders: HeadersInit | undefined,
  headers: HeadersInit | undefined,
): Headers | undefined {
  if (!defaultHeaders && !headers) {
    return undefined;
  }

  const mergedHeaders = new Headers(defaultHeaders);
  new Headers(headers).forEach((value, key) => {
    mergedHeaders.set(key, value);
  });

  return mergedHeaders;
}

function canUseCachedAccessToken(
  token: AccessTokenResult,
  options: GetAccessTokenOptions,
): boolean {
  const skew = options.refreshBeforeExpiresIn ?? 60;
  return token.expiresAt > Math.floor(Date.now() / 1000) + skew;
}

function getAccessTokenCacheKey(
  options: Pick<FetchAccessTokenOptions, 'route' | 'scopes'>,
) {
  return JSON.stringify([
    options.route ?? getPublicAccessTokenRoute(),
    normalizeScopes(options.scopes),
  ]);
}

async function getErrorMessage(response: Response): Promise<string> {
  const payload = (await readJson(response)) as
    | { error_description?: unknown }
    | undefined;

  if (typeof payload?.error_description === 'string') {
    return payload.error_description;
  }

  return `Unable to load an access token (${response.status}).`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function normalizeScopes(scopes: string | Array<string> | undefined) {
  return Array.isArray(scopes) ? scopes.join(' ') : scopes;
}
