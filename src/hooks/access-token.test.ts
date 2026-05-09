import { useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAccessTokenProvider,
  fetchAccessToken,
  useAccessToken,
} from './access-token';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options: unknown) => options),
}));

const originalPublicAccessTokenRoute =
  process.env.NEXT_PUBLIC_ACCESS_TOKEN_ROUTE;

describe('fetchAccessToken', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_ACCESS_TOKEN_ROUTE;
    vi.mocked(useQuery).mockClear();
  });

  afterEach(() => {
    restorePublicAccessTokenRoute();
    vi.unstubAllGlobals();
  });

  it('fetches an access token from the default route', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'access-token',
        expiresAt: 123,
        scope: 'openid',
        type: 'Bearer',
      }),
    });

    await expect(fetchAccessToken()).resolves.toEqual({
      accessToken: 'access-token',
      expiresAt: 123,
      scope: 'openid',
      type: 'Bearer',
    });
    expect(fetch).toHaveBeenCalledWith('/auth/access-token', {
      body: undefined,
      credentials: 'same-origin',
      headers: new Headers(),
      method: undefined,
    });
  });

  it('uses the configured public access-token route by default', async () => {
    process.env.NEXT_PUBLIC_ACCESS_TOKEN_ROUTE = '/api/access-token';
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'access-token',
        expiresAt: 123,
      }),
    });

    await fetchAccessToken();

    expect(fetch).toHaveBeenCalledWith('/api/access-token', {
      body: undefined,
      credentials: 'same-origin',
      headers: new Headers(),
      method: undefined,
    });
  });

  it('posts refresh and scope options to the access-token route', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'access-token',
        expiresAt: 123,
        scope: 'reports:read',
      }),
    });

    await fetchAccessToken({
      refresh: true,
      refreshBeforeExpiresIn: 120,
      route: '/api/token',
      scopes: ['reports:read'],
    });

    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;

    expect(fetch).toHaveBeenCalledWith('/api/token', expect.any(Object));
    expect(init.body).toBe(
      JSON.stringify({
        refresh: true,
        refreshBeforeExpiresIn: 120,
        scopes: ['reports:read'],
      }),
    );
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('content-type')).toBe(
      'application/json',
    );
    expect(init.method).toBe('POST');
  });

  it('throws readable access-token errors', async () => {
    mockFetch({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'ERR_MISSING_SESSION',
        error_description: 'A session is required.',
      }),
    });

    await expect(fetchAccessToken()).rejects.toThrow('A session is required.');
  });

  it('throws a fallback error when the route returns an unexpected error body', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(fetchAccessToken()).rejects.toThrow(
      'Unable to load an access token (500).',
    );
  });

  it('configures TanStack Query for access-token fetching', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'access-token',
        expiresAt: 123,
      }),
    });

    useAccessToken({
      refresh: true,
      route: '/api/token',
      scopes: ['reports:read'],
      staleTime: 1000,
    });

    const options = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      queryFn: () => Promise<unknown>;
      queryKey: unknown;
      staleTime: number;
    };

    expect(options.queryKey).toEqual([
      'mondo-auth',
      'access-token',
      '/api/token',
      'reports:read',
      true,
      undefined,
    ]);
    expect(options.staleTime).toBe(1000);
    await expect(options.queryFn()).resolves.toEqual({
      accessToken: 'access-token',
      expiresAt: 123,
    });
  });
});

describe('createAccessTokenProvider', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_ACCESS_TOKEN_ROUTE;
    vi.mocked(useQuery).mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    restorePublicAccessTokenRoute();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reuses a cached access token while it is fresh', async () => {
    const provider = createAccessTokenProvider();
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'access-token',
        expiresAt: epoch() + 300,
      }),
    });

    await expect(provider.getAccessToken()).resolves.toEqual({
      accessToken: 'access-token',
      expiresAt: epoch() + 300,
    });
    await expect(provider.getAccessToken()).resolves.toEqual({
      accessToken: 'access-token',
      expiresAt: epoch() + 300,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('loads a new token when the cached token is inside the refresh window', async () => {
    const provider = createAccessTokenProvider();
    mockFetch(
      {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'old-token',
          expiresAt: epoch() + 30,
        }),
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'new-token',
          expiresAt: epoch() + 300,
        }),
      },
    );

    await expect(provider.getAccessToken()).resolves.toMatchObject({
      accessToken: 'old-token',
    });
    await expect(provider.getAccessToken()).resolves.toMatchObject({
      accessToken: 'new-token',
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent cache misses', async () => {
    const provider = createAccessTokenProvider();
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: 'access-token',
        expiresAt: epoch() + 300,
      }),
    });

    await expect(
      Promise.all([provider.getAccessToken(), provider.getAccessToken()]),
    ).resolves.toEqual([
      {
        accessToken: 'access-token',
        expiresAt: epoch() + 300,
      },
      {
        accessToken: 'access-token',
        expiresAt: epoch() + 300,
      },
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cached token when refresh is requested', async () => {
    const provider = createAccessTokenProvider();
    mockFetch(
      {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'old-token',
          expiresAt: epoch() + 300,
        }),
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'new-token',
          expiresAt: epoch() + 300,
        }),
      },
    );

    await expect(provider.getAccessToken()).resolves.toMatchObject({
      accessToken: 'old-token',
    });
    await expect(
      provider.getAccessToken({ refresh: true }),
    ).resolves.toMatchObject({
      accessToken: 'new-token',
    });
    await expect(provider.getAccessToken()).resolves.toMatchObject({
      accessToken: 'new-token',
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('clears cached tokens', async () => {
    const provider = createAccessTokenProvider({ scopes: ['reports:read'] });
    mockFetch(
      {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'old-token',
          expiresAt: epoch() + 300,
        }),
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'new-token',
          expiresAt: epoch() + 300,
        }),
      },
    );

    await expect(provider.getAccessToken()).resolves.toMatchObject({
      accessToken: 'old-token',
    });
    provider.clear({ scopes: ['reports:read'] });
    await expect(provider.getAccessToken()).resolves.toMatchObject({
      accessToken: 'new-token',
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

function mockFetch(
  ...responses: Array<Partial<Response> & { json: () => Promise<any> }>
) {
  const fetchMock = vi.fn();

  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }

  vi.stubGlobal('fetch', fetchMock);
}

function epoch() {
  return Math.floor(Date.now() / 1000);
}

function restorePublicAccessTokenRoute() {
  if (originalPublicAccessTokenRoute === undefined) {
    delete process.env.NEXT_PUBLIC_ACCESS_TOKEN_ROUTE;
    return;
  }

  process.env.NEXT_PUBLIC_ACCESS_TOKEN_ROUTE = originalPublicAccessTokenRoute;
}
