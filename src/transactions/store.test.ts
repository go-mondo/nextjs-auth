import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../test-utils';

const mocks = vi.hoisted(() => ({
  getIronSession: vi.fn(),
}));

vi.mock('iron-session', () => ({
  getIronSession: mocks.getIronSession,
}));

const { TransactionStore, transactionStoreFactory } = await import('./store');

describe('TransactionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a configured transaction store', async () => {
    const cookie = createCookie();
    mocks.getIronSession.mockResolvedValue(cookie);
    const store = transactionStoreFactory(
      createTestConfig(),
      createCookieStore(),
    );

    await store.save({
      code_verifier: 'verifier',
      nonce: 'nonce',
      state: 'state',
    });

    expect(mocks.getIronSession).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        cookieName: '__Host-Mondo.Verification',
        cookieOptions: expect.objectContaining({ httpOnly: true }),
      }),
    );
  });

  it('saves verification data', async () => {
    const cookie = createCookie();
    mocks.getIronSession.mockResolvedValue(cookie);
    const store = createStore();

    await store.save({
      code_verifier: 'verifier',
      nonce: 'nonce',
      state: 'state',
      max_age: 300,
      return_to: '/dashboard',
    });

    expect(cookie).toMatchObject({
      code_verifier: 'verifier',
      nonce: 'nonce',
      state: 'state',
      max_age: 300,
      return_to: '/dashboard',
    });
    expect(cookie.save).toHaveBeenCalledTimes(1);
  });

  it('reads and destroys complete verification data', async () => {
    const cookie = createCookie({
      code_verifier: 'verifier',
      nonce: 'nonce',
      state: 'state',
      return_to: '/dashboard',
    });
    mocks.getIronSession.mockResolvedValue(cookie);
    const store = createStore();

    await expect(store.read()).resolves.toEqual({
      code_verifier: 'verifier',
      nonce: 'nonce',
      state: 'state',
      max_age: undefined,
      return_to: '/dashboard',
    });
    expect(cookie.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys incomplete verification data', async () => {
    const cookie = createCookie({ nonce: 'nonce' });
    mocks.getIronSession.mockResolvedValue(cookie);
    const store = createStore();

    await expect(store.read()).resolves.toBeUndefined();
    expect(cookie.destroy).toHaveBeenCalledTimes(1);
  });
});

function createStore() {
  return new TransactionStore(
    { 1: 'secret' },
    createCookieStore(),
    'transaction',
    { path: '/', httpOnly: true },
  );
}

function createCookie(values: Record<string, unknown> = {}) {
  return {
    save: vi.fn(),
    destroy: vi.fn(),
    ...values,
  };
}

function createCookieStore() {
  return {
    get: vi.fn(),
    set: vi.fn(),
  };
}
