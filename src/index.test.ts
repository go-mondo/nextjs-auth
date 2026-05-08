import { describe, expect, it } from 'vitest';
import { createAuth, MondoAuthClient } from './index';
import { testSecret } from './test-utils';

describe('package exports', () => {
  it('exports the auth client factory', () => {
    expect(
      createAuth({
        secret: testSecret,
        issuerBaseURL: 'https://id.example.com',
        baseURL: 'https://app.example.com',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }),
    ).toBeInstanceOf(MondoAuthClient);
  });
});
