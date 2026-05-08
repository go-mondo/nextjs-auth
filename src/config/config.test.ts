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

const routeEnvNames = [
  'NEXT_PUBLIC_MONDO_LOGIN_ROUTE',
  'NEXT_PUBLIC_MONDO_SESSION_ROUTE',
  'NEXT_PUBLIC_MONDO_ACCESS_TOKEN_ROUTE',
  'MONDO_CALLBACK_ROUTE',
  'MONDO_LOGOUT_ROUTE',
  'MONDO_SESSION_ROUTE',
  'MONDO_ACCESS_TOKEN_ROUTE',
  'MONDO_POST_LOGOUT_REDIRECT_ROUTE',
] as const;
const originalRouteEnv = new Map(
  routeEnvNames.map((name) => [name, process.env[name]]),
);

describe('getConfig', () => {
  beforeEach(() => {
    clearRouteEnv();
  });

  afterEach(() => {
    restoreRouteEnv();
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
    process.env.NEXT_PUBLIC_MONDO_SESSION_ROUTE = '/api/session';

    const config = getConfig(validConfig);

    expect(config.routes.session).toBe('/api/session');
  });

  it('uses the public access-token route when no server-only access-token route is set', () => {
    process.env.NEXT_PUBLIC_MONDO_ACCESS_TOKEN_ROUTE = '/api/access-token';

    const config = getConfig(validConfig);

    expect(config.routes.accessToken).toBe('/api/access-token');
  });

  it('reads route overrides from explicit route environment variables', () => {
    process.env.NEXT_PUBLIC_MONDO_LOGIN_ROUTE = '/api/login';
    process.env.MONDO_CALLBACK_ROUTE = '/api/callback';
    process.env.MONDO_LOGOUT_ROUTE = '/api/logout';
    process.env.MONDO_SESSION_ROUTE = '/api/session/server';
    process.env.MONDO_ACCESS_TOKEN_ROUTE = '/api/access-token/server';
    process.env.MONDO_POST_LOGOUT_REDIRECT_ROUTE = '/signed-out';

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

function clearRouteEnv() {
  for (const name of routeEnvNames) {
    delete process.env[name];
  }
}

function restoreRouteEnv() {
  for (const name of routeEnvNames) {
    const originalValue = originalRouteEnv.get(name);

    if (originalValue === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = originalValue;
    }
  }
}
