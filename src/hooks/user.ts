import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { getPublicSessionRoute } from '../config/routes';
import type { Claims, UserProfile } from '../session/types';

/**
 * JSON shapes accepted from the mounted session route.
 *
 * The default session route returns `{ user }` as part of the full session, but
 * apps may transform that route to return the user profile directly.
 */
export type UserProfileEndpointResponse<UserClaims extends Claims = Claims> =
  | { user?: UserProfile<UserClaims> | null | undefined }
  | UserProfile<UserClaims>
  | null
  | undefined;

/**
 * Options for fetching the current user profile from browser code.
 */
export type FetchUserProfileOptions = {
  /**
   * Mounted session route. Defaults to `/auth/session`.
   */
  route?: string;

  /**
   * Additional fetch options merged with `credentials: "same-origin"`.
   */
  request?: RequestInit;
};

/**
 * Default TanStack Query key used by {@link useUserProfile}.
 */
export type UseUserProfileQueryKey = readonly [
  'mondo-auth',
  'user-profile',
  string,
];

/**
 * Options accepted by {@link useUserProfile}.
 *
 * All normal TanStack Query options are supported except `queryFn` and
 * `queryKey`, which are owned by the hook. Pass `queryKey` here to override the
 * default key.
 */
export type UseUserProfileOptions<
  UserClaims extends Claims = Claims,
  TData = UserProfile<UserClaims> | undefined,
  TQueryKey extends QueryKey = UseUserProfileQueryKey,
> = FetchUserProfileOptions &
  Omit<
    UseQueryOptions<
      UserProfile<UserClaims> | undefined,
      Error,
      TData,
      TQueryKey
    >,
    'queryFn' | 'queryKey'
  > & {
    /**
     * TanStack Query key. Defaults to `["mondo-auth", "user-profile", route]`.
     */
    queryKey?: TQueryKey;
  };

/**
 * Fetches the currently authenticated user profile from the mounted session
 * route.
 *
 * This reads the app's local server-managed session. It does not call the
 * authorization server directly.
 *
 * @returns The current user profile, or `undefined` when no session exists.
 */
export async function fetchUserProfile<UserClaims extends Claims = Claims>(
  options: FetchUserProfileOptions = {},
): Promise<UserProfile<UserClaims> | undefined> {
  const { request, route = getPublicSessionRoute() } = options;
  const response = await fetch(route, {
    credentials: 'same-origin',
    ...request,
  });

  if (response.status === 401 || response.status === 403) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Unable to load the current user (${response.status}).`);
  }

  return userProfileFromResponse<UserClaims>(
    (await response.json()) as UserProfileEndpointResponse<UserClaims>,
  );
}

/**
 * TanStack Query hook for the currently authenticated user profile.
 *
 * Apps must provide a `QueryClientProvider` above this hook. The hook reads the
 * app's local session endpoint and caches the resulting user profile in
 * TanStack Query.
 */
export function useUserProfile<
  UserClaims extends Claims = Claims,
  TData = UserProfile<UserClaims> | undefined,
  TQueryKey extends QueryKey = UseUserProfileQueryKey,
>(
  options: UseUserProfileOptions<UserClaims, TData, TQueryKey> = {},
): UseQueryResult<TData, Error> {
  const {
    queryKey,
    route = getPublicSessionRoute(),
    request,
    ...queryOptions
  } = options;

  return useQuery({
    queryKey:
      queryKey ??
      (['mondo-auth', 'user-profile', route] satisfies UseUserProfileQueryKey),
    queryFn: () => fetchUserProfile<UserClaims>({ request, route }),
    ...queryOptions,
  } as UseQueryOptions<
    UserProfile<UserClaims> | undefined,
    Error,
    TData,
    TQueryKey
  >);
}

function userProfileFromResponse<UserClaims extends Claims>(
  payload: UserProfileEndpointResponse<UserClaims>,
): UserProfile<UserClaims> | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  if ('user' in payload) {
    return isRecord(payload.user)
      ? (payload.user as UserProfile<UserClaims>)
      : undefined;
  }

  return payload as UserProfile<UserClaims>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}
