import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from './session/model';
import { epoch } from './session/utils';
import { testSecret } from './test-utils';

const mocks = vi.hoisted(() => ({
  sessionStoreFactory: vi.fn(),
}));

vi.mock('./session/stores/stateless-store', () => ({
  sessionStoreFactory: mocks.sessionStoreFactory,
}));

const { createAuth } = await import('./client');

describe('MondoAuthClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defers configuration validation until config is used', () => {
    const auth = createAuth();

    expect(() => auth.handleAuth()).not.toThrow();
    expect(() => auth.config).toThrow(
      'Invalid @go-mondo/nextjs-auth configuration',
    );
  });

  it('returns 404s for unmatched auth routes', async () => {
    const auth = createAuth({
      secret: testSecret,
      issuerBaseURL: 'https://id.example.com',
      baseURL: 'https://app.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    const response = await auth.handleAuth()(
      new Request('https://app.example.com/auth/unknown'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: 'NotFound',
    });
  });

  it('lets auth and public paths pass through proxy', async () => {
    const auth = createConfiguredAuth();

    await expect(
      auth.proxy(new Request('https://app.example.com/auth/login')),
    ).resolves.toBeUndefined();
    await expect(
      auth.proxy(new Request('https://app.example.com/public/page'), {
        publicPaths: ['/public'],
      }),
    ).resolves.toBeUndefined();
    expect(mocks.sessionStoreFactory).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated proxy requests to login', async () => {
    const auth = createConfiguredAuth();
    mockStore(undefined);

    const response = await auth.proxy(
      new Request('https://app.example.com/dashboard?tab=home'),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'https://app.example.com/auth/login?returnTo=%2Fdashboard%3Ftab%3Dhome',
    );
  });

  it('supports custom proxy returnTo values', async () => {
    const auth = createConfiguredAuth();
    mockStore(undefined);

    const response = await auth.proxy(
      new Request('https://app.example.com/dashboard'),
      {
        returnTo: async () => '/after-login',
      },
    );

    expect(response?.headers.get('location')).toBe(
      'https://app.example.com/auth/login?returnTo=%2Fafter-login',
    );
  });

  it('touches authenticated proxy sessions', async () => {
    const auth = createConfiguredAuth();
    const store = mockStore(createSession());

    const response = await auth.proxy(
      new Request('https://app.example.com/dashboard'),
    );

    expect(response?.status).toBe(200);
    expect(store.get).toHaveBeenCalledTimes(1);
    expect(store.touch).toHaveBeenCalledTimes(1);
  });

  it('delegates getSession to the configured session store', async () => {
    const session = createSession();
    mockStore(session);
    const auth = createConfiguredAuth();

    await expect(auth.getSession()).resolves.toBe(session);
  });
});

function createConfiguredAuth() {
  return createAuth({
    secret: testSecret,
    issuerBaseURL: 'https://id.example.com',
    baseURL: 'https://app.example.com',
    clientId: 'client-id',
    clientSecret: 'client-secret',
  });
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
