import { describe, expect, it } from 'vitest';
import { createIdToken } from '../test-utils';
import { fromTokenEndpointResponse } from './model';

describe('fromTokenEndpointResponse', () => {
  it('normalizes token endpoint responses into session cookies', () => {
    const session = fromTokenEndpointResponse({
      id_token: createIdToken({
        name: 'Ada Lovelace',
        custom_claim: 'custom-value',
      }),
      access_token: 'access-token',
      expires_in: 120,
      refresh_token: 'refresh-token',
      scope: 'openid profile email',
      token_type: 'Bearer',
      vendor_extra: 'extra',
    });

    expect(session.user).toMatchObject({
      tnt: 'tenant',
      sub: 'user_123',
      email: 'user@example.com',
      name: 'Ada Lovelace',
      custom_claim: 'custom-value',
    });
    expect(session.authentication).toEqual({
      idToken: expect.any(String),
    });
    expect(session.authorization).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenScope: 'openid profile email',
      accessTokenType: 'Bearer',
    });
    expect(session.authorization?.accessTokenExpiresAt).toBeGreaterThanOrEqual(
      Math.floor(Date.now() / 1000) + 119,
    );
    expect(session).toHaveProperty('vendor_extra', 'extra');
  });

  it('throws when the id token is malformed', () => {
    expect(() =>
      fromTokenEndpointResponse({
        id_token: 'not-a-jwt',
      }),
    ).toThrow(TypeError);
  });
});
