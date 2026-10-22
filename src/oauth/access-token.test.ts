import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessTokenErrorCode } from '../errors/access-token';
import { Session } from '../session/model';
import { epoch } from '../session/utils';
import { createTestConfig } from '../test-utils';

const mocks = vi.hoisted(() => {
  class ResponseBodyError extends Error {
    public readonly error: string;

    constructor(error: string) {
      super(error);
      this.error = error;
    }
  }

  return {
    discoverOIDC: vi.fn(),
    refreshTokenGrant: vi.fn(),
    ResponseBodyError,
    sessionStoreFactory: vi.fn(),
  };
});

vi.mock('./oidc', () => ({
  discoverOIDC: mocks.discoverOIDC,
}));

vi.mock('../session/stores/stateless-store', () => ({
  sessionStoreFactory: mocks.sessionStoreFactory,
}));

vi.mock('openid-client', () => ({
  refreshTokenGrant: mocks.refreshTokenGrant,
  ResponseBodyError: mocks.ResponseBodyError,
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

  it('identifies refresh tokens rejected with invalid_grant', async () => {
    mockStore(
      createSession({
        authorization: {
          accessToken: 'expired-token',
          expiresAt: epoch() - 1,
          refreshToken: 'refresh-token',
        },
      }),
    );
    mocks.refreshTokenGrant.mockRejectedValue(
      new mocks.ResponseBodyError('invalid_grant'),
    );

    await expect(getToken()).rejects.toMatchObject({
      code: AccessTokenErrorCode.INVALID_REFRESH_TOKEN,
    });
  });

  it('identifies resources rejected with invalid_target', async () => {
    mockStore(createSession());
    mocks.refreshTokenGrant.mockRejectedValue(
      new mocks.ResponseBodyError('invalid_target'),
    );

    await expect(getToken({ resource: RESOURCE })).rejects.toMatchObject({
      code: AccessTokenErrorCode.INVALID_TARGET,
    });
  });

  it('still reports other refresh errors as failed grants', async () => {
    mockStore(createSession());
    mocks.refreshTokenGrant.mockRejectedValue(
      new mocks.ResponseBodyError('server_error'),
    );

    await expect(getToken({ resource: RESOURCE })).rejects.toMatchObject({
      code: AccessTokenErrorCode.FAILED_REFRESH_GRANT,
    });
  });

  describe('with a resource', () => {
    it('refreshes even when the stored token is valid and has the requested scopes', async () => {
      mockStore(createSession());
      mocks.refreshTokenGrant.mockResolvedValue({
        access_token: 'resource-token',
        expires_in: 600,
      });

      await expect(
        getToken({ resource: RESOURCE, scopes: ['email'] }),
      ).resolves.toMatchObject({ accessToken: 'resource-token' });
      expect(mocks.refreshTokenGrant).toHaveBeenCalledTimes(1);
    });

    it('sends the resource and scope to the token endpoint', async () => {
      mockStore(createSession());
      mocks.refreshTokenGrant.mockResolvedValue({
        access_token: 'resource-token',
      });

      await getToken({ resource: RESOURCE, scopes: ['openid', 'email'] });

      const params = mocks.refreshTokenGrant.mock.calls[0]?.[2];
      expect(params).toBeInstanceOf(URLSearchParams);
      expect(params.getAll('resource')).toEqual([RESOURCE]);
      expect(params.get('scope')).toBe('openid email');
    });

    it('sends the resource without a scope when none is requested', async () => {
      mockStore(createSession());
      mocks.refreshTokenGrant.mockResolvedValue({
        access_token: 'resource-token',
      });

      await getToken({ resource: RESOURCE });

      const params = mocks.refreshTokenGrant.mock.calls[0]?.[2];
      expect(params.get('resource')).toBe(RESOURCE);
      expect(params.has('scope')).toBe(false);
    });

    it('returns the new token without storing it in the session', async () => {
      const session = createSession();
      const original = { ...session.authorization };
      const store = mockStore(session);
      mocks.refreshTokenGrant.mockResolvedValue({
        access_token: 'resource-token',
        expires_in: 600,
        scope: 'openid email',
        token_type: 'Bearer',
      });

      await expect(getToken({ resource: RESOURCE })).resolves.toEqual({
        accessToken: 'resource-token',
        expiresAt: expect.any(Number),
        resource: RESOURCE,
        scope: 'openid email',
        type: 'Bearer',
      });
      expect(session.authorization).toEqual(original);
      expect(store.set).not.toHaveBeenCalled();
    });

    it('persists a rotated refresh token and nothing else', async () => {
      const session = createSession();
      const original = { ...session.authorization };
      const store = mockStore(session);
      mocks.refreshTokenGrant.mockResolvedValue({
        access_token: 'resource-token',
        expires_in: 600,
        refresh_token: 'rotated-refresh-token',
        scope: 'openid email workspace',
      });

      await getToken({ resource: RESOURCE });

      expect(store.set).toHaveBeenCalledWith(session);
      expect(session.authorization).toEqual({
        ...original,
        refreshToken: 'rotated-refresh-token',
      });
    });

    it('uses a short default lifetime when the server omits expires_in', async () => {
      mockStore(
        createSession({
          authorization: {
            accessToken: 'expired-sign-in-token',
            expiresAt: epoch() - 600,
            refreshToken: 'refresh-token',
          },
        }),
      );
      mocks.refreshTokenGrant.mockResolvedValue({
        access_token: 'resource-token',
      });

      const token = await getToken({ resource: RESOURCE });

      expect(token.expiresAt).toBeGreaterThanOrEqual(epoch() + 299);
      expect(token.expiresAt).toBeLessThanOrEqual(epoch() + 300);
    });

    it('queues concurrent refreshes so a rotated refresh token is reused', async () => {
      const resourceB = 'https://api.example.com/workspaces/tenant_456';
      const stores = [mockStore(createSession()), mockStore(createSession())];
      mocks.sessionStoreFactory
        .mockReturnValueOnce(stores[0])
        .mockReturnValueOnce(stores[1])
        .mockReturnValueOnce(stores[0])
        .mockReturnValueOnce(stores[1]);
      mocks.refreshTokenGrant
        .mockResolvedValueOnce({
          access_token: 'token-a',
          refresh_token: 'refresh-token-2',
        })
        .mockResolvedValueOnce({
          access_token: 'token-b',
          refresh_token: 'refresh-token-3',
        });
      const getter = getAccessTokenFactory({ config: createTestConfig() });

      const tokens = await Promise.all([
        getter({ resource: RESOURCE }),
        getter({ resource: resourceB }),
      ]);

      expect(tokens.map((token) => token.accessToken)).toEqual([
        'token-a',
        'token-b',
      ]);
      expect(mocks.refreshTokenGrant.mock.calls.map((call) => call[1])).toEqual(
        ['refresh-token', 'refresh-token-2'],
      );
      expect(stores[1]?.set).toHaveBeenCalledWith(
        expect.objectContaining({
          authorization: expect.objectContaining({
            refreshToken: 'refresh-token-3',
          }),
        }),
      );
    });

    it('reports a failed session update separately from the grant', async () => {
      const store = mockStore(createSession());
      store.set.mockRejectedValue(new Error('Cookies are read-only'));
      mocks.refreshTokenGrant.mockResolvedValue({
        access_token: 'resource-token',
        refresh_token: 'rotated-refresh-token',
      });

      await expect(getToken({ resource: RESOURCE })).rejects.toMatchObject({
        code: AccessTokenErrorCode.FAILED_SESSION_UPDATE,
      });
    });

    it('requires a refresh token', async () => {
      mockStore(
        createSession({
          authorization: {
            accessToken: 'current-token',
            expiresAt: epoch() + 3600,
          },
        }),
      );

      await expect(getToken({ resource: RESOURCE })).rejects.toMatchObject({
        code: AccessTokenErrorCode.MISSING_REFRESH_TOKEN,
      });
      expect(mocks.refreshTokenGrant).not.toHaveBeenCalled();
    });
  });
});

const RESOURCE = 'https://api.example.com/workspaces/tenant_123';

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
