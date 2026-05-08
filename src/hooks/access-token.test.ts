import { useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAccessToken, useAccessToken } from './access-token';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options: unknown) => options),
}));

const originalPublicAccessTokenRoute =
  process.env.NEXT_PUBLIC_MONDO_ACCESS_TOKEN_ROUTE;

describe('fetchAccessToken', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MONDO_ACCESS_TOKEN_ROUTE;
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
    process.env.NEXT_PUBLIC_MONDO_ACCESS_TOKEN_ROUTE = '/api/access-token';
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

function mockFetch(response: Partial<Response> & { json: () => Promise<any> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

function restorePublicAccessTokenRoute() {
  if (originalPublicAccessTokenRoute === undefined) {
    delete process.env.NEXT_PUBLIC_MONDO_ACCESS_TOKEN_ROUTE;
    return;
  }

  process.env.NEXT_PUBLIC_MONDO_ACCESS_TOKEN_ROUTE =
    originalPublicAccessTokenRoute;
}
