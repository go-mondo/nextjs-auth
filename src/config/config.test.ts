import { describe, expect, it } from 'vitest';
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

describe('getConfig', () => {
  it('validates and normalizes the core configuration', () => {
    const config = getConfig({
      ...validConfig,
      authorizationParams: {
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
    expect(config.authorizationParams.audience).toBe('https://api.example.com');
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
    expect(schema.shape.authorizationParams.description).toContain(
      'Authorization URL parameters',
    );
    expect(schema.shape.routes.description).toBe(
      'Application routes mounted by the auth client.',
    );
  });
});
