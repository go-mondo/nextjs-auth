import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../../test-utils';
import { Session } from '../model';
import { epoch } from '../utils';

const mocks = vi.hoisted(() => ({
  getIronSession: vi.fn(),
}));

vi.mock('iron-session', () => ({
  getIronSession: mocks.getIronSession,
}));

const { NewStatelessSessionStore, sessionStoreFactory } = await import(
  './stateless-store'
);

describe('NewStatelessSessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is created by the factory', () => {
    expect(sessionStoreFactory(createTestConfig())).toBeInstanceOf(
      NewStatelessSessionStore,
    );
  });

  it('combines session cookies into one session', async () => {
    const now = epoch();
    mocks.getIronSession
      .mockResolvedValueOnce({
        data: {
          user: { tnt: 'tenant', sub: 'user_123' },
          issuedAt: now,
          updatedAt: now,
          expiresAt: now + 3600,
        },
      })
      .mockResolvedValueOnce({
        data: {
          accessToken: 'access-token',
          expiresAt: now + 600,
        },
      })
      .mockResolvedValueOnce({ data: { idToken: 'id-token' } });
    const store = createStore();

    await expect(store.get()).resolves.toMatchObject({
      user: { tnt: 'tenant' },
      authorization: { accessToken: 'access-token' },
      authentication: { idToken: 'id-token' },
    });
  });

  it('returns undefined when the base session cookie is missing', async () => {
    mocks.getIronSession
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const store = createStore();

    await expect(store.get()).resolves.toBeUndefined();
  });

  it('splits a session across the sealed cookies', async () => {
    const cookies = [createCookie(), createCookie(), createCookie()] as const;
    mocks.getIronSession
      .mockResolvedValueOnce(cookies[0])
      .mockResolvedValueOnce(cookies[1])
      .mockResolvedValueOnce(cookies[2]);
    const session = createSession();
    const store = createStore();

    await store.set(session);

    expect(cookies[0].data).toEqual({
      user: session.user,
      issuedAt: session.issuedAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
    });
    expect(cookies[1].data).toBe(session.authorization);
    expect(cookies[2].data).toBe(session.authentication);
    expect(cookies.map((cookie) => cookie.save)).toEqual([
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ]);
    expect(cookies[0].save).toHaveBeenCalledTimes(1);
    expect(cookies[1].save).toHaveBeenCalledTimes(1);
    expect(cookies[2].save).toHaveBeenCalledTimes(1);
  });

  it('destroys all sealed cookies', async () => {
    const cookies = [createCookie(), createCookie(), createCookie()] as const;
    mocks.getIronSession
      .mockResolvedValueOnce(cookies[0])
      .mockResolvedValueOnce(cookies[1])
      .mockResolvedValueOnce(cookies[2]);
    const store = createStore();

    await store.delete();

    expect(cookies[0].destroy).toHaveBeenCalledTimes(1);
    expect(cookies[1].destroy).toHaveBeenCalledTimes(1);
    expect(cookies[2].destroy).toHaveBeenCalledTimes(1);
  });

  it('configures iron-session cookie names and options', async () => {
    mocks.getIronSession
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const store = createStore();

    await store.get();

    expect(mocks.getIronSession).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.objectContaining({
        cookieName: '__Host-Mondo.Session',
        cookieOptions: expect.objectContaining({ httpOnly: true, path: '/' }),
      }),
    );
    expect(mocks.getIronSession).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ cookieName: '__Host-Mondo.Authorization' }),
    );
    expect(mocks.getIronSession).toHaveBeenNthCalledWith(
      3,
      expect.any(Object),
      expect.objectContaining({ cookieName: '__Host-Mondo.Authentication' }),
    );
  });
});

function createStore() {
  return new NewStatelessSessionStore(
    createTestConfig(),
    undefined,
    undefined,
    () => ({
      get: vi.fn(),
      set: vi.fn(),
    }),
  );
}

function createSession() {
  const now = epoch();

  return new Session({
    user: { tnt: 'tenant', sub: 'user_123' },
    issuedAt: now,
    updatedAt: now,
    expiresAt: now + 3600,
    authorization: {
      accessToken: 'access-token',
      expiresAt: now + 600,
      refreshToken: 'refresh-token',
    },
    authentication: { idToken: 'id-token' },
  });
}

function createCookie() {
  return {
    data: undefined,
    save: vi.fn(),
    destroy: vi.fn(),
  };
}
