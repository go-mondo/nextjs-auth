import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../test-utils';

const mocks = vi.hoisted(() => ({
  allowInsecureRequests: Symbol('allowInsecureRequests'),
  discovery: vi.fn(),
}));

vi.mock('openid-client', () => ({
  allowInsecureRequests: mocks.allowInsecureRequests,
  discovery: mocks.discovery,
}));

const { discoverOIDC } = await import('./discovery');

describe('discoverOIDC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.discovery.mockResolvedValue({ issuer: 'https://id.example.com' });
  });

  it('discovers the configured issuer', async () => {
    await expect(discoverOIDC(createTestConfig())).resolves.toEqual({
      issuer: 'https://id.example.com',
    });

    expect(mocks.discovery).toHaveBeenCalledWith(
      new URL('https://id.example.com'),
      'client-id',
      'client-secret',
      undefined,
      undefined,
    );
  });

  it('allows insecure requests for localhost issuers', async () => {
    await discoverOIDC(
      createTestConfig({ issuerBaseURL: 'http://localhost:3001' }),
    );

    expect(mocks.discovery).toHaveBeenCalledWith(
      new URL('http://localhost:3001'),
      'client-id',
      'client-secret',
      undefined,
      {
        execute: [mocks.allowInsecureRequests],
      },
    );
  });
});
