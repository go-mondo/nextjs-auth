import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../test-utils';

const mocks = vi.hoisted(() => ({
  authorizationCodeGrant: vi.fn(),
  cookieFactory: vi.fn(),
  discoverOIDC: vi.fn(),
  fromTokenEndpointResponse: vi.fn(),
  sessionStoreFactory: vi.fn(),
  transactionStoreFactory: vi.fn(),
}));

vi.mock('../http/cookies', () => ({
  cookieFactory: mocks.cookieFactory,
}));

vi.mock('../transactions/store', () => ({
  transactionStoreFactory: mocks.transactionStoreFactory,
}));

vi.mock('../session/stores/stateless-store', () => ({
  sessionStoreFactory: mocks.sessionStoreFactory,
}));

vi.mock('../session/model', () => ({
  fromTokenEndpointResponse: mocks.fromTokenEndpointResponse,
}));

vi.mock('../oauth/oidc', () => ({
  discoverOIDC: mocks.discoverOIDC,
}));

vi.mock('openid-client', () => ({
  authorizationCodeGrant: mocks.authorizationCodeGrant,
}));

const { callbackHandlerFactory } = await import('./callback');

describe('callbackHandlerFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieFactory.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
    mocks.discoverOIDC.mockResolvedValue({ issuer: 'https://id.example.com' });
    mocks.authorizationCodeGrant.mockResolvedValue({ id_token: 'id-token' });
    mocks.fromTokenEndpointResponse.mockReturnValue({
      user: { tnt: 'tenant' },
    });
  });

  it('exchanges the code, stores the session, and redirects to returnTo', async () => {
    const transactionStore = {
      read: vi.fn().mockResolvedValue({
        code_verifier: 'verifier',
        max_age: 300,
        nonce: 'nonce',
        return_to: 'https://app.example.com/profile',
        state: 'state',
      }),
    };
    const sessionStore = { set: vi.fn() };
    mocks.transactionStoreFactory.mockReturnValue(transactionStore);
    mocks.sessionStoreFactory.mockReturnValue(sessionStore);

    const response = await handler({
      tokenParameters: { audience: 'api' },
    })(
      new Request('https://app.example.com/auth/callback?code=abc&state=state'),
    );

    expect(mocks.cookieFactory).toHaveBeenCalledWith();
    expect(mocks.authorizationCodeGrant).toHaveBeenCalledWith(
      { issuer: 'https://id.example.com' },
      new URL('https://app.example.com/auth/callback?code=abc&state=state'),
      {
        expectedNonce: 'nonce',
        expectedState: 'state',
        idTokenExpected: true,
        maxAge: 300,
        pkceCodeVerifier: 'verifier',
      },
      { audience: 'api' },
    );
    expect(mocks.fromTokenEndpointResponse).toHaveBeenCalledWith({
      id_token: 'id-token',
    });
    expect(sessionStore.set).toHaveBeenCalledWith({
      user: { tnt: 'tenant' },
    });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.example.com/profile',
    );
  });

  it('redirects to the configured base URL when returnTo is missing', async () => {
    mocks.transactionStoreFactory.mockReturnValue({
      read: vi.fn().mockResolvedValue({
        code_verifier: 'verifier',
        nonce: 'nonce',
        state: 'state',
      }),
    });
    mocks.sessionStoreFactory.mockReturnValue({ set: vi.fn() });

    const response = await handler()(
      new Request('https://app.example.com/auth/callback?code=abc&state=state'),
    );

    expect(response.headers.get('location')).toBe('https://app.example.com/');
  });

  it('wraps missing transaction state as a callback handler error', async () => {
    mocks.transactionStoreFactory.mockReturnValue({
      read: vi.fn().mockResolvedValue(undefined),
    });
    mocks.sessionStoreFactory.mockReturnValue({ set: vi.fn() });

    await expect(
      handler()(
        new Request(
          'https://app.example.com/auth/callback?code=abc&state=state',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'ERR_CALLBACK_HANDLER_FAILURE',
      cause: expect.objectContaining({
        status: 400,
      }),
    });
  });
});

function handler(
  options?: Parameters<ReturnType<typeof callbackHandlerFactory>>[0],
) {
  return callbackHandlerFactory({ config: createTestConfig() })(options);
}
