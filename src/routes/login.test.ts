import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../test-utils';

const mocks = vi.hoisted(() => ({
  buildAuthorizationUrl: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  cookieFactory: vi.fn(),
  discoverOIDC: vi.fn(),
  randomNonce: vi.fn(),
  randomPKCECodeVerifier: vi.fn(),
  randomState: vi.fn(),
  transactionStoreFactory: vi.fn(),
}));

vi.mock('../http/cookies', () => ({
  cookieFactory: mocks.cookieFactory,
}));

vi.mock('../transactions/store', () => ({
  transactionStoreFactory: mocks.transactionStoreFactory,
}));

vi.mock('../oidc/discovery', () => ({
  discoverOIDC: mocks.discoverOIDC,
}));

vi.mock('openid-client', () => ({
  buildAuthorizationUrl: mocks.buildAuthorizationUrl,
  calculatePKCECodeChallenge: mocks.calculatePKCECodeChallenge,
  randomNonce: mocks.randomNonce,
  randomPKCECodeVerifier: mocks.randomPKCECodeVerifier,
  randomState: mocks.randomState,
}));

const { loginHandlerFactory } = await import('./login');

describe('loginHandlerFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieFactory.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
    mocks.discoverOIDC.mockResolvedValue({ issuer: 'https://id.example.com' });
    mocks.randomNonce.mockReturnValue('nonce');
    mocks.randomState.mockReturnValue('state');
    mocks.randomPKCECodeVerifier.mockReturnValue('verifier');
    mocks.calculatePKCECodeChallenge.mockResolvedValue('challenge');
    mocks.buildAuthorizationUrl.mockReturnValue(
      new URL('https://id.example.com/authorize?state=state'),
    );
  });

  it('stores transaction state and redirects to the identity provider', async () => {
    const transactionStore = { save: vi.fn() };
    mocks.transactionStoreFactory.mockReturnValue(transactionStore);

    const response = await handler({
      authorizationParams: {
        max_age: 300,
        scope: 'openid email',
      },
      returnTo: '/profile',
    })(new Request('https://preview.example.com/auth/login'));

    expect(transactionStore.save).toHaveBeenCalledWith({
      code_verifier: 'verifier',
      max_age: 300,
      nonce: 'nonce',
      return_to: '/profile',
      state: 'state',
    });
    expect(mocks.buildAuthorizationUrl).toHaveBeenCalledWith(
      { issuer: 'https://id.example.com' },
      expect.objectContaining({
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        nonce: 'nonce',
        redirect_uri: 'https://preview.example.com/auth/callback',
        response_type: 'code',
        scope: 'openid email',
        state: 'state',
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://id.example.com/authorize?state=state',
    );
  });

  it('uses safe returnTo query values', async () => {
    const transactionStore = { save: vi.fn() };
    mocks.transactionStoreFactory.mockReturnValue(transactionStore);

    await handler()(
      new Request('https://app.example.com/auth/login?returnTo=/settings'),
    );

    expect(transactionStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        return_to: 'https://app.example.com/settings',
      }),
    );
  });

  it('ignores unsafe returnTo query values', async () => {
    const transactionStore = { save: vi.fn() };
    mocks.transactionStoreFactory.mockReturnValue(transactionStore);

    await handler()(
      new Request(
        'https://app.example.com/auth/login?returnTo=https://evil.example.com',
      ),
    );

    expect(transactionStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        return_to: 'https://app.example.com',
      }),
    );
  });
});

function handler(
  options?: Parameters<ReturnType<typeof loginHandlerFactory>>[0],
) {
  return loginHandlerFactory({ config: createTestConfig() })(options);
}
