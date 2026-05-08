import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile, useUserProfile } from './user';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options: unknown) => options),
}));

const originalPublicSessionRoute = process.env.NEXT_PUBLIC_MONDO_SESSION_ROUTE;

describe('fetchUserProfile', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MONDO_SESSION_ROUTE;
    vi.mocked(useQuery).mockClear();
  });

  afterEach(() => {
    restorePublicSessionRoute();
    vi.unstubAllGlobals();
  });

  it('returns the user from a session response', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          tnt: 'tenant',
          sub: 'user_123',
          email: 'user@example.com',
        },
      }),
    });

    await expect(fetchUserProfile()).resolves.toEqual({
      tnt: 'tenant',
      sub: 'user_123',
      email: 'user@example.com',
    });
    expect(fetch).toHaveBeenCalledWith('/auth/session', {
      credentials: 'same-origin',
    });
  });

  it('returns a transformed user response directly', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        tnt: 'tenant',
        sub: 'user_123',
      }),
    });

    await expect(fetchUserProfile()).resolves.toEqual({
      tnt: 'tenant',
      sub: 'user_123',
    });
  });

  it('returns undefined when the session response has no user', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        user: null,
      }),
    });

    await expect(fetchUserProfile()).resolves.toBeUndefined();
  });

  it('returns undefined when no session exists', async () => {
    mockFetch({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'SessionNotFound',
      }),
    });

    await expect(fetchUserProfile()).resolves.toBeUndefined();
  });

  it('returns undefined when access to the session is forbidden', async () => {
    mockFetch({
      ok: false,
      status: 403,
      json: async () => ({
        error: 'Forbidden',
      }),
    });

    await expect(fetchUserProfile()).resolves.toBeUndefined();
  });

  it('uses the configured public session route by default', async () => {
    process.env.NEXT_PUBLIC_MONDO_SESSION_ROUTE = '/api/session';
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          tnt: 'tenant',
        },
      }),
    });

    await fetchUserProfile();

    expect(fetch).toHaveBeenCalledWith('/api/session', {
      credentials: 'same-origin',
    });
  });

  it('throws for unexpected failures', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(fetchUserProfile()).rejects.toThrow(
      'Unable to load the current user (500).',
    );
  });

  it('supports custom routes and request options', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          tnt: 'tenant',
        },
      }),
    });

    await fetchUserProfile({
      request: {
        headers: {
          accept: 'application/json',
        },
      },
      route: '/api/me',
    });

    expect(fetch).toHaveBeenCalledWith('/api/me', {
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
      },
    });
  });

  it('configures TanStack Query for the user profile endpoint', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          tnt: 'tenant',
        },
      }),
    });

    useUserProfile({
      queryKey: ['custom-user-profile'],
      request: {
        headers: {
          accept: 'application/json',
        },
      },
      route: '/api/me',
      staleTime: 1000,
    });

    const options = vi.mocked(useQuery).mock.calls[0]?.[0] as {
      queryFn: () => Promise<unknown>;
      queryKey: unknown;
      staleTime: number;
    };

    expect(options.queryKey).toEqual(['custom-user-profile']);
    expect(options.staleTime).toBe(1000);
    await expect(options.queryFn()).resolves.toEqual({
      tnt: 'tenant',
    });
    expect(fetch).toHaveBeenCalledWith('/api/me', {
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
      },
    });
  });
});

function mockFetch(response: Partial<Response> & { json: () => Promise<any> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

function restorePublicSessionRoute() {
  if (originalPublicSessionRoute === undefined) {
    delete process.env.NEXT_PUBLIC_MONDO_SESSION_ROUTE;
    return;
  }

  process.env.NEXT_PUBLIC_MONDO_SESSION_ROUTE = originalPublicSessionRoute;
}
