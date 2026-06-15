import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError } from '../errors/config';
import { getConfig } from './config';
import schema from './schema';

const validConfig = {
  baseURL: 'https://app.example.com/',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  issuerBaseURL: 'https://identity.example.com/',
  secret: '01234567890123456789012345678901',
};
const validConfigWithoutBaseURL = {
  clientId: validConfig.clientId,
  clientSecret: validConfig.clientSecret,
  issuerBaseURL: validConfig.issuerBaseURL,
  secret: validConfig.secret,
};

const envNames = [
  'MONDO_SECRET',
  'MONDO_ISSUER_BASE_URL',
  'MONDO_CLIENT_ID',
  'MONDO_CLIENT_SECRET',
  'MONDO_AUDIENCE',
  'MONDO_SCOPE',
  'APP_BASE_URL',
  'NEXT_PUBLIC_APP_BASE_URL',
  'NEXT_PUBLIC_LOGIN_ROUTE',
  'NEXT_PUBLIC_SESSION_ROUTE',
  'NEXT_PUBLIC_ACCESS_TOKEN_ROUTE',
  'CALLBACK_ROUTE',
  'LOGOUT_ROUTE',
  'SESSION_ROUTE',
  'ACCESS_TOKEN_ROUTE',
  'POST_LOGOUT_REDIRECT_ROUTE',
  'MONDO_SESSION_NAME',
  'MONDO_SESSION_IDLE_DURATION',
  'MONDO_SESSION_ABSOLUTE_DURATION',
  'MONDO_COOKIE_DOMAIN',
  'MONDO_COOKIE_PATH',
  'MONDO_COOKIE_SECURE',
  'MONDO_COOKIE_SAME_SITE',
  'MONDO_TRANSACTION_COOKIE_NAME',
  'MONDO_TRANSACTION_COOKIE_DOMAIN',
  'MONDO_TRANSACTION_COOKIE_PATH',
  'MONDO_TRANSACTION_COOKIE_SECURE',
  'MONDO_TRANSACTION_COOKIE_SAME_SITE',
] as const;
const originalEnv = new Map(envNames.map((name) => [name, process.env[name]]));

describe('getConfig', () => {
  beforeEach(() => {
    clearEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('validates and normalizes the core configuration', () => {
    const config = getConfig({
      ...validConfig,
      authorization: {
        audience: 'https://api.example.com',
        scope: 'openid profile email offline_access',
      },
    });

    expect(config.baseURL).toBe('https://app.example.com');
    expect(config.issuerBaseURL).toBe('https://identity.example.com');
    expect(config.routes).toMatchObject({
      login: '/auth/login',
      callback: '/auth/callback',
      logout: '/auth/logout',
      session: '/auth/session',
      accessToken: '/auth/access-token',
    });
    expect(config.session.name).toBe('__Host-Mondo');
    expect(config.transaction.name).toBe('__Host-Mondo.Verification');
    expect(config.authorization.audience).toBe('https://api.example.com');
  });

  it('allows idle session updates to be disabled when absolute expiry is set', () => {
    const config = getConfig({
      ...validConfig,
      session: {
        idleDuration: false,
        absoluteDuration: 3600,
      },
    });

    expect(config.session.idleDuration).toBe(false);
    expect(config.session.absoluteDuration).toBe(3600);
  });

  it('uses the public session route when no server-only session route is set', () => {
    process.env.NEXT_PUBLIC_SESSION_ROUTE = '/api/session';

    const config = getConfig(validConfig);

    expect(config.routes.session).toBe('/api/session');
  });

  it('uses the public access-token route when no server-only access-token route is set', () => {
    process.env.NEXT_PUBLIC_ACCESS_TOKEN_ROUTE = '/api/access-token';

    const config = getConfig(validConfig);

    expect(config.routes.accessToken).toBe('/api/access-token');
  });

  it('reads the base URL from APP_BASE_URL', () => {
    process.env.APP_BASE_URL = 'app.example.com';

    const config = getConfig(validConfigWithoutBaseURL);

    expect(config.baseURL).toBe('https://app.example.com');
  });

  it('falls back to NEXT_PUBLIC_APP_BASE_URL for the base URL', () => {
    process.env.NEXT_PUBLIC_APP_BASE_URL = 'https://public.example.com';

    const config = getConfig(validConfigWithoutBaseURL);

    expect(config.baseURL).toBe('https://public.example.com');
  });

  it('reads route overrides from explicit route environment variables', () => {
    process.env.NEXT_PUBLIC_LOGIN_ROUTE = '/api/login';
    process.env.CALLBACK_ROUTE = '/api/callback';
    process.env.LOGOUT_ROUTE = '/api/logout';
    process.env.SESSION_ROUTE = '/api/session/server';
    process.env.ACCESS_TOKEN_ROUTE = '/api/access-token/server';
    process.env.POST_LOGOUT_REDIRECT_ROUTE = '/signed-out';

    const config = getConfig(validConfig);

    expect(config.routes).toMatchObject({
      login: '/api/login',
      callback: '/api/callback',
      logout: '/api/logout',
      session: '/api/session/server',
      accessToken: '/api/access-token/server',
      postLogoutRedirect: '/signed-out',
    });
  });

  it('requires at least one session expiration mode', () => {
    expect(() =>
      getConfig({
        ...validConfig,
        session: {
          idleDuration: false,
          absoluteDuration: false,
        },
      }),
    ).toThrow('At least one of idleDuration or absoluteDuration');
  });

  it('throws a readable error when required configuration is missing', () => {
    expect(() => getConfig({ clientId: 'client-id' })).toThrow(ConfigError);
    expect(() => getConfig({ clientId: 'client-id' })).toThrow(
      'Invalid @go-mondo/nextjs-auth configuration',
    );

    try {
      getConfig({ clientId: 'client-id' });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.any(String),
            path: expect.any(Array),
          }),
        ]),
      );
    }
  });

  it('rejects route paths that contain double slashes', () => {
    expect(() =>
      getConfig({
        ...validConfig,
        routes: {
          callback: '/auth//callback',
        },
      }),
    ).toThrow('- routes.callback: Must not contain "//".');
  });

  it('rejects domain-scoped __Host session cookies', () => {
    expect(() =>
      getConfig({
        ...validConfig,
        session: {
          cookie: {
            domain: 'example.com',
          },
        },
      }),
    ).toThrow(
      '- session.cookie.domain: __Host- cookies must not set a domain.',
    );
  });

  it('rejects non-root __Host session cookie paths', () => {
    expect(() =>
      getConfig({
        ...validConfig,
        session: {
          cookie: {
            path: '/auth',
          },
        },
      }),
    ).toThrow('- session.cookie.path: __Host- cookies must use path "/".');
  });

  it('rejects insecure prefixed transaction cookies', () => {
    expect(() =>
      getConfig({
        ...validConfig,
        transaction: {
          cookie: {
            secure: false,
          },
        },
      }),
    ).toThrow(
      '- transaction.cookie.secure: __Host- and __Secure- cookies must be secure.',
    );
  });

  it('allows domain-scoped cookies when the caller opts out of __Host names', () => {
    const config = getConfig({
      ...validConfig,
      session: {
        name: '__Secure-Mondo',
        cookie: {
          domain: 'example.com',
        },
      },
      transaction: {
        name: '__Secure-Mondo.Verification',
        cookie: {
          domain: 'example.com',
        },
      },
    });

    expect(config.session.cookie.domain).toBe('example.com');
    expect(config.transaction.cookie.domain).toBe('example.com');
  });

  it('describes the schema for generated docs and debugging', () => {
    expect(schema.description).toBe(
      'Validated configuration for @go-mondo/nextjs-auth.',
    );
    expect(schema.shape.authorization.description).toContain(
      'Authorization URL parameters',
    );
    expect(schema.shape.routes.description).toBe(
      'Application routes mounted by the auth client.',
    );
  });
});

function clearEnv() {
  for (const name of envNames) {
    delete process.env[name];
  }
}

function restoreEnv() {
  for (const name of envNames) {
    const originalValue = originalEnv.get(name);

    if (originalValue === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = originalValue;
    }
  }
}
