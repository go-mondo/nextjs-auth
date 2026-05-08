import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '../session/model';
import { epoch } from '../session/utils';
import { createTestConfig } from '../test-utils';

const mocks = vi.hoisted(() => ({
  sessionStoreFactory: vi.fn(),
}));

vi.mock('../session/stores/stateless-store', () => ({
  sessionStoreFactory: mocks.sessionStoreFactory,
}));

const { sessionHandlerFactory } = await import('./session');

describe('sessionHandlerFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a 401 when no session exists', async () => {
    mockStore(undefined);

    const response = await handler()(new Request('https://app.example.com'));

    await expect(response.json()).resolves.toMatchObject({
      error: 'SessionNotFound',
    });
    expect(response.status).toBe(401);
  });

  it('touches the session by default', async () => {
    const session = createSession();
    const store = mockStore(session);

    const response = await handler()(new Request('https://app.example.com'));

    expect(store.touch).toHaveBeenCalledTimes(1);
    expect(store.get).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      user: { tnt: 'tenant' },
    });
  });

  it('can read without touching and transform the response', async () => {
    const store = mockStore(createSession());

    const response = await handler({
      touch: false,
      transform: (session) => ({ tenant: session?.user.tnt }),
    })(new Request('https://app.example.com'));

    expect(store.get).toHaveBeenCalledTimes(1);
    expect(store.touch).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ tenant: 'tenant' });
  });
});

function handler(
  options?: Parameters<ReturnType<typeof sessionHandlerFactory>>[0],
) {
  return sessionHandlerFactory({ config: createTestConfig() })(options);
}

function mockStore(session: Session | undefined) {
  const store = {
    get: vi.fn().mockResolvedValue(session),
    set: vi.fn(),
    delete: vi.fn(),
    touch: vi.fn().mockResolvedValue(session),
  };
  mocks.sessionStoreFactory.mockReturnValue(store);
  return store;
}

function createSession() {
  const now = epoch();

  return new Session({
    user: { tnt: 'tenant', sub: 'user_123' },
    issuedAt: now,
    updatedAt: now,
    expiresAt: now + 3600,
  });
}
