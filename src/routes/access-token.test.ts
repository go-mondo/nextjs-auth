import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessTokenError, AccessTokenErrorCode } from '../errors/access-token';
import { ConfigError } from '../errors/config';

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
}));

vi.mock('../oauth/access-token', () => ({
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

  it('uses POST body options when returning an access token', async () => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
      scope: 'reports:read',
    });

    const response = await handler()(
      new Request('https://app.example.com', {
        body: JSON.stringify({
          refresh: true,
          refreshBeforeExpiresIn: 120,
          scopes: ['reports:read'],
        }),
        method: 'POST',
      }),
    );

    expect(mocks.getAccessToken).toHaveBeenCalledWith({
      refresh: true,
      refreshBeforeExpiresIn: 120,
      scopes: ['reports:read'],
    });
    await expect(response.json()).resolves.toEqual({
      accessToken: 'access-token',
      expiresAt: 123,
      scope: 'reports:read',
    });
  });

  it('accepts string scopes from POST body options', async () => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
      scope: 'reports:read',
    });

    await handler()(
      new Request('https://app.example.com', {
        body: JSON.stringify({ scopes: 'reports:read' }),
        method: 'POST',
      }),
    );

    expect(mocks.getAccessToken).toHaveBeenCalledWith({
      scopes: 'reports:read',
    });
  });

  it('keeps static options when POST body omits overrides', async () => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
    });

    await handler({ refresh: true })(
      new Request('https://app.example.com', {
        body: JSON.stringify({}),
        method: 'POST',
      }),
    );

    expect(mocks.getAccessToken).toHaveBeenCalledWith({
      refresh: true,
    });
  });

  it('passes a valid resource from the POST body', async () => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
      resource: RESOURCE,
    });

    const response = await handler()(post({ resource: RESOURCE }));

    expect(response.status).toBe(200);
    expect(mocks.getAccessToken).toHaveBeenCalledWith({ resource: RESOURCE });
  });

  it.each([
    'http://localhost:3000/workspaces/tenant_123',
    'http://127.0.0.1/workspaces/tenant_123',
  ])('allows http resources on localhost (%s)', async (resource) => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
    });

    const response = await handler()(post({ resource }));

    expect(response.status).toBe(200);
    expect(mocks.getAccessToken).toHaveBeenCalledWith({ resource });
  });

  it('uses a static resource option', async () => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
    });

    await handler({ resource: RESOURCE })(
      new Request('https://app.example.com'),
    );

    expect(mocks.getAccessToken).toHaveBeenCalledWith({ resource: RESOURCE });
  });

  it('lets a POST body resource override the static resource', async () => {
    mocks.getAccessToken.mockResolvedValue({
      accessToken: 'access-token',
      expiresAt: 123,
    });
    const resource = 'https://api.example.com/workspaces/tenant_456';

    await handler({ resource: RESOURCE })(post({ resource }));

    expect(mocks.getAccessToken).toHaveBeenCalledWith({ resource });
  });

  it.each([
    ['a non-string', 123],
    ['null', null],
    ['a relative URL', '/workspaces/tenant_123'],
    ['a non-https URL', 'http://api.example.com/workspaces/tenant_123'],
    ['a non-http scheme', 'urn:example:tenant_123'],
    ['a URL with a fragment', 'https://api.example.com/workspaces/t#x'],
    ['a URL with an empty fragment', 'https://api.example.com/workspaces/t#'],
    ['a URL with leading whitespace', ' https://api.example.com/workspaces/t'],
    ['a URL with an embedded tab', 'https://api.example.com/work\tspaces/t'],
    ['a URL without //', 'https:api.example.com/workspaces/t'],
    ['a URL with a control character', 'https://api.example.com/\u0001t'],
  ])('rejects %s resource with 400', async (_label, resource) => {
    const response = await handler({ resource: RESOURCE })(post({ resource }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: AccessTokenErrorCode.INVALID_REQUEST,
    });
    expect(mocks.getAccessToken).not.toHaveBeenCalled();
  });

  it.each([
    'http://api.example.com/workspaces/tenant_123',
    'https://api.example.com/workspaces/tenant_123#x',
  ])('rejects an invalid static resource (%s)', (resource) => {
    expect(() => handler({ resource })).toThrow(ConfigError);
  });

  it.each([
    [AccessTokenErrorCode.MISSING_SESSION, 401],
    [AccessTokenErrorCode.INVALID_REFRESH_TOKEN, 401],
    [AccessTokenErrorCode.INSUFFICIENT_SCOPE, 403],
    [AccessTokenErrorCode.INVALID_TARGET, 403],
    [AccessTokenErrorCode.FAILED_REFRESH_GRANT, 502],
    [AccessTokenErrorCode.FAILED_SESSION_UPDATE, 500],
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

const RESOURCE = 'https://api.example.com/workspaces/tenant_123';

function post(body: unknown) {
  return new Request('https://app.example.com', {
    body: JSON.stringify(body),
    method: 'POST',
  });
}

function handler(
  options?: Parameters<ReturnType<typeof accessTokenHandlerFactory>>[0],
) {
  return accessTokenHandlerFactory({ config: {} as never })(options);
}
