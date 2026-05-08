import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../test-utils';

const mocks = vi.hoisted(() => ({
  sessionStoreFactory: vi.fn(),
}));

vi.mock('../session/stores/stateless-store', () => ({
  sessionStoreFactory: mocks.sessionStoreFactory,
}));

const { logoutHandlerFactory } = await import('./logout');

describe('logoutHandlerFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the session and redirects to the app base URL', async () => {
    const store = mockStore();

    const response = await handler()(new Request('https://app.example.com'));

    expect(store.delete).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://app.example.com/');
  });

  it('uses safe returnTo query values', async () => {
    mockStore();

    const response = await handler()(
      new Request('https://app.example.com/auth/logout?returnTo=/settings'),
    );

    expect(response.headers.get('location')).toBe(
      'https://app.example.com/settings',
    );
  });

  it('ignores unsafe returnTo query values', async () => {
    mockStore();

    const response = await handler()(
      new Request(
        'https://app.example.com/auth/logout?returnTo=https://evil.example.com',
      ),
    );

    expect(response.headers.get('location')).toBe('https://app.example.com/');
  });

  it('can redirect through the identity provider logout endpoint', async () => {
    mockStore();

    const response = await handler({ singleLogOut: true, returnTo: '/bye' })(
      new Request('https://app.example.com/auth/logout'),
    );

    expect(response.headers.get('location')).toBe(
      'https://id.example.com/logout?redirectTo=https://app.example.com/bye',
    );
  });
});

function handler(
  options?: Parameters<ReturnType<typeof logoutHandlerFactory>>[0],
) {
  return logoutHandlerFactory({ config: createTestConfig() })(options);
}

function mockStore() {
  const store = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    touch: vi.fn(),
  };
  mocks.sessionStoreFactory.mockReturnValue(store);
  return store;
}
