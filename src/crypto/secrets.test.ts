import { describe, expect, it } from 'vitest';
import { createTestConfig } from '../test-utils';
import { getSecrets } from './secrets';

describe('getSecrets', () => {
  it('returns a single secret using iron-session password id 1', () => {
    expect(
      getSecrets(
        createTestConfig({
          secret: 'current-secret-with-at-least-thirty-two-chars',
        }),
      ),
    ).toEqual({
      1: 'current-secret-with-at-least-thirty-two-chars',
    });
  });

  it('maps secret arrays so the newest secret has the highest id', () => {
    expect(
      getSecrets(
        createTestConfig({
          secret: [
            'new-secret-with-at-least-thirty-two-chars',
            'old-secret-with-at-least-thirty-two-chars',
          ],
        }),
      ),
    ).toEqual({
      1: 'old-secret-with-at-least-thirty-two-chars',
      2: 'new-secret-with-at-least-thirty-two-chars',
    });
  });
});
