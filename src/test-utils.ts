import { getConfig } from './config/config';
import type { Config, PartialConfig } from './config/types';
import { epoch } from './session/utils';

export const testSecret = 'test-secret-with-at-least-thirty-two-characters';

export function createTestConfig(config: PartialConfig = {}): Config {
  return getConfig({
    secret: testSecret,
    issuerBaseURL: 'https://id.example.com',
    baseURL: 'https://app.example.com',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    ...config,
  });
}

export function createIdToken(claims: Record<string, unknown> = {}): string {
  const now = epoch();
  const payload = {
    iss: 'https://id.example.com',
    aud: 'client-id',
    nonce: 'nonce',
    iat: now,
    exp: now + 3600,
    tnt: 'tenant',
    sub: 'user_123',
    email: 'user@example.com',
    ...claims,
  };

  return [
    encodeBase64Url({ alg: 'none', typ: 'JWT' }),
    encodeBase64Url(payload),
    '',
  ].join('.');
}

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString('base64url')
    .replace(/=+$/, '');
}
