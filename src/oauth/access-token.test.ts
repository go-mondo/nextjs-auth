import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessTokenErrorCode } from '../errors/access-token';
import { Session } from '../session/model';
import { epoch } from '../session/utils';
import { createTestConfig } from '../test-utils';

const mocks = vi.hoisted(() => ({
  discoverOIDC: vi.fn(),
  refreshTokenGrant: vi.fn(),
  sessionStoreFactory: vi.fn(),
}));

vi.mock('./oidc', () => ({
  discoverOIDC: mocks.discoverOIDC,
}));

vi.mock('../session/stores/stateless-store', () => ({
  sessionStoreFactory: mocks.sessionStoreFactory,
}));

vi.mock('openid-client', () => ({
  refreshTokenGrant: mocks.refreshTokenGrant,
}));

const { getAccessTokenFactory } = await import('./access-token');

describe('getAccessTokenFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.discoverOIDC.mockResolvedValue({ issuer: 'https://id.example.com' });
  });

  it('requires an authenticated session', async () => {
    mockStore(undefined);

    await expect(getToken()).rejects.toMatchObject({
      code: AccessTokenErrorCode.MISSING_SESSION,
    });
  });

  it('requires an access token in the session', async () => {
    mockStore(createSession({ authorization: undefined }));

    await expect(getToken()).rejects.toMatchObject({
      code: AccessTokenErrorCode.MISSING_ACCESS_TOKEN,
    });
  });

  it('returns a valid token without refreshing', async () => {
    const store = mockStore(
      createSession({
        authorization: {
          accessToken: 'current-token',
          expiresAt: epoch() + 3600,
          scope: 'openid email profile',
          type: 'Bearer',
          refreshToken: 'refresh-token',
        },
      }),
    );

    await expect(
      getToken({ scopes: ['email', 'profile'] }),
    ).resolves.toMatchObject({
      accessToken: 'current-token',
      scope: 'openid email profile',
      type: 'Bearer',
    });
    expect(mocks.refreshTokenGrant).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it('fails expired tokens that cannot be refreshed', async () => {
    mockStore(
      createSession({
        authorization: {
          accessToken: 'expired-token',
          expiresAt: epoch() - 1,
        },
      }),
    );

    await expect(getToken()).rejects.toMatchObject({
      code: AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN,
    });
  });

  it('fails tokens missing requested scopes when refresh is unavailable', async () => {
    mockStore(
      createSession({
        authorization: {
          accessToken: 'limited-token',
          expiresAt: epoch() + 3600,
          scope: 'openid',
        },
      }),
    );

    await expect(getToken({ scopes: 'email' })).rejects.toMatchObject({
      code: AccessTokenErrorCode.INSUFFICIENT_SCOPE,
    });
  });

  it('refreshes expired tokens and persists the updated authorization', async () => {
    const session = createSession({
      authorization: {
        accessToken: 'expired-token',
        expiresAt: epoch() - 1,
        scope: 'openid',
        type: 'Bearer',
        refreshToken: 'refresh-token',
      },
    });
    const store = mockStore(session);
    mocks.refreshTokenGrant.mockResolvedValue({
      access_token: 'new-token',
      expires_in: 600,
      refresh_token: 'new-refresh-token',
      scope: 'openid email',
      token_type: 'Bearer',
    });

    await expect(getToken({ scopes: ['openid', 'email'] })).resolves.toEqual({
      accessToken: 'new-token',
      expiresAt: expect.any(Number),
      scope: 'openid email',
      type: 'Bearer',
    });

    expect(mocks.refreshTokenGrant).toHaveBeenCalledWith(
      { issuer: 'https://id.example.com' },
      'refresh-token',
      expect.any(URLSearchParams),
    );
    expect(mocks.refreshTokenGrant.mock.calls[0]?.[2].get('scope')).toBe(
      'openid email',
    );
    expect(store.set).toHaveBeenCalledWith(session);
    expect(session.authorization).toMatchObject({
      accessToken: 'new-token',
      refreshToken: 'new-refresh-token',
      scope: 'openid email',
    });
  });

  it('normalizes failed refresh responses', async () => {
    mockStore(
      createSession({
        authorization: {
          accessToken: 'expired-token',
          expiresAt: epoch() - 1,
          refreshToken: 'refresh-token',
        },
      }),
    );
    mocks.refreshTokenGrant.mockResolvedValue({});

    await expect(getToken()).rejects.toMatchObject({
      code: AccessTokenErrorCode.FAILED_REFRESH_GRANT,
    });
  });
});

function getToken(
  options?: Parameters<ReturnType<typeof getAccessTokenFactory>>[0],
) {
  return getAccessTokenFactory({ config: createTestConfig() })(options);
}

function mockStore(session: Session | undefined) {
  const store = {
    get: vi.fn().mockResolvedValue(session),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
    touch: vi.fn(),
  };
  mocks.sessionStoreFactory.mockReturnValue(store);
  return store;
}

function createSession(
  overrides: Partial<ConstructorParameters<typeof Session>[0]> = {},
) {
  const now = epoch();

  return new Session({
    user: { tnt: 'tenant', sub: 'user_123' },
    issuedAt: now,
    updatedAt: now,
    expiresAt: now + 3600,
    authorization: {
      accessToken: 'access-token',
      expiresAt: now + 3600,
      scope: 'openid email',
      type: 'Bearer',
      refreshToken: 'refresh-token',
    },
    ...overrides,
  });
}
