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
