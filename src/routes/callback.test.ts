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

  it('cleans up the transaction and displays a message when consent is denied', async () => {
    const transactionStore = {
      read: vi.fn().mockResolvedValue({
        code_verifier: 'verifier',
        nonce: 'nonce',
        state: 'state',
      }),
    };
    const sessionStore = { set: vi.fn() };
    mocks.transactionStoreFactory.mockReturnValue(transactionStore);
    mocks.sessionStoreFactory.mockReturnValue(sessionStore);

    const response = await handler()(
      new Request(
        'https://app.example.com/auth/callback?error=access_denied&error_description=The+resource+owner+denied+the+request.&state=state',
      ),
    );

    expect(transactionStore.read).toHaveBeenCalledWith();
    expect(mocks.discoverOIDC).not.toHaveBeenCalled();
    expect(mocks.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(sessionStore.set).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
    const body = await response.text();
    expect(body).toContain('Sign-in was not completed');
    expect(body).toContain('You did not grant permission to continue.');
    expect(body).not.toContain('<p>The resource owner denied the request.</p>');
    expect(body).toContain('window.opener');
    expect(body).toContain('window.opener.postMessage');
    expect(body).toContain('"type":"mondo-auth:authorization-error"');
    expect(body).toContain('window.close()');
  });

  it('redirects verified authorization errors to the configured error route', async () => {
    const transactionStore = {
      read: vi.fn().mockResolvedValue({
        code_verifier: 'verifier',
        nonce: 'nonce',
        state: 'state',
      }),
    };
    const sessionStore = { set: vi.fn() };
    mocks.transactionStoreFactory.mockReturnValue(transactionStore);
    mocks.sessionStoreFactory.mockReturnValue(sessionStore);

    const response = await handler(undefined, {
      routes: { authorizationError: '/auth/denied' },
    })(
      new Request(
        'https://app.example.com/auth/callback?error=access_denied&error_description=The+resource+owner+denied+the+request.&state=state',
      ),
    );

    expect(transactionStore.read).toHaveBeenCalledWith();
    expect(mocks.discoverOIDC).not.toHaveBeenCalled();
    expect(mocks.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(sessionStore.set).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.example.com/auth/denied?error=access_denied',
    );
  });

  it('handles form_post authorization errors', async () => {
    const transactionStore = {
      read: vi.fn().mockResolvedValue({
        code_verifier: 'verifier',
        nonce: 'nonce',
        state: 'state',
      }),
    };
    const sessionStore = { set: vi.fn() };
    mocks.transactionStoreFactory.mockReturnValue(transactionStore);
    mocks.sessionStoreFactory.mockReturnValue(sessionStore);

    const response = await handler(undefined, {
      routes: { authorizationError: '/auth/denied' },
    })(
      new Request('https://app.example.com/auth/callback', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          error: 'access_denied',
          error_description: 'The resource owner denied the request.',
          state: 'state',
        }),
      }),
    );

    expect(mocks.discoverOIDC).not.toHaveBeenCalled();
    expect(mocks.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(sessionStore.set).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.example.com/auth/denied?error=access_denied',
    );
  });

  it('escapes provider error descriptions before displaying them', async () => {
    mocks.transactionStoreFactory.mockReturnValue({
      read: vi.fn().mockResolvedValue({
        code_verifier: 'verifier',
        nonce: 'nonce',
        state: 'state',
      }),
    });
    mocks.sessionStoreFactory.mockReturnValue({ set: vi.fn() });

    const response = await handler()(
      new Request(
        'https://app.example.com/auth/callback?error=server_error&error_description=%3Cscript%3Ealert(1)%3C%2Fscript%3E&state=state',
      ),
    );

    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).not.toContain('window.close()');
  });

  it('escapes denied consent descriptions inside the popup script', async () => {
    mocks.transactionStoreFactory.mockReturnValue({
      read: vi.fn().mockResolvedValue({
        code_verifier: 'verifier',
        nonce: 'nonce',
        state: 'state',
      }),
    });
    mocks.sessionStoreFactory.mockReturnValue({ set: vi.fn() });

    const response = await handler()(
      new Request(
        'https://app.example.com/auth/callback?error=access_denied&error_description=%3C%2Fscript%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E&state=state',
      ),
    );

    const body = await response.text();
    expect(body).not.toContain(
      '&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(body).toContain('\\u003c/script\\u003e');
    expect(body).not.toContain('</script><script>alert(1)</script>');
  });

  it('wraps authorization errors with mismatched state as a callback handler error', async () => {
    mocks.transactionStoreFactory.mockReturnValue({
      read: vi.fn().mockResolvedValue({
        code_verifier: 'verifier',
        nonce: 'nonce',
        state: 'state',
      }),
    });
    mocks.sessionStoreFactory.mockReturnValue({ set: vi.fn() });

    await expect(
      handler()(
        new Request(
          'https://app.example.com/auth/callback?error=access_denied&state=other',
        ),
      ),
    ).rejects.toMatchObject({
      code: 'ERR_CALLBACK_HANDLER_FAILURE',
      cause: expect.objectContaining({
        message: 'State parameter mismatch in Authorization Response.',
        status: 400,
      }),
    });
  });

  it('redirects callback handler failures to the configured error route', async () => {
    mocks.transactionStoreFactory.mockReturnValue({
      read: vi.fn().mockResolvedValue(undefined),
    });
    mocks.sessionStoreFactory.mockReturnValue({ set: vi.fn() });

    const response = await handler(undefined, {
      routes: { callbackError: '/auth/callback-problem' },
    })(
      new Request('https://app.example.com/auth/callback?code=abc&state=state'),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.example.com/auth/callback-problem?error=callback_error',
    );
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
  config?: Parameters<typeof createTestConfig>[0],
) {
  return callbackHandlerFactory({ config: createTestConfig(config) })(options);
}
