import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessTokenError, AccessTokenErrorCode } from '../errors/access-token';

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
}));

vi.mock('../oidc/access-token', () => ({
  getAccessTokenFactory: () => mocks.getAccessToken,
}));

const { accessTokenHandlerFactory } = await import('./access-token');

describe('accessTokenHandlerFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns token JSON', async () => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
      scope: 'openid',
    });

    const response = await handler()(new Request('https://app.example.com'));

    await expect(response.json()).resolves.toEqual({
      accessToken: 'access-token',
      expiresAt: 123,
      scope: 'openid',
    });
  });

  it('supports response transforms', async () => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
    });

    const response = await handler({
      transform: (token) => ({ expiresAt: token.expiresAt }),
    })(new Request('https://app.example.com'));

    await expect(response.json()).resolves.toEqual({ expiresAt: 123 });
  });

  it.each([
    [AccessTokenErrorCode.MISSING_SESSION, 401],
    [AccessTokenErrorCode.INSUFFICIENT_SCOPE, 403],
    [AccessTokenErrorCode.FAILED_REFRESH_GRANT, 502],
  ])('maps %s to %i', async (code, status) => {
    mocks.getAccessToken.mockRejectedValue(
      new AccessTokenError(code, 'Token failed.'),
    );

    const response = await handler()(new Request('https://app.example.com'));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: code,
      error_description: 'Token failed.',
    });
  });

  it('rethrows unexpected errors', async () => {
    mocks.getAccessToken.mockRejectedValue(new Error('boom'));

    await expect(
      handler()(new Request('https://app.example.com')),
    ).rejects.toThrow('boom');
  });
});

function handler(
  options?: Parameters<ReturnType<typeof accessTokenHandlerFactory>>[0],
) {
  return accessTokenHandlerFactory({ config: {} as never })(options);
}
