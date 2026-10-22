import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MondoInstance } from '../core/instance';
import {
  queueRefreshGrant,
  REFRESH_TOKEN_ROTATION_GRACE_SECONDS,
} from './refresh-grant-queue';

describe('queueRefreshGrant', () => {
  let instance: MondoInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    instance = { config: {} as never };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs concurrent grants one at a time with the latest refresh token', async () => {
    const grant = vi
      .fn()
      .mockResolvedValueOnce({ refresh_token: 'r2' })
      .mockResolvedValueOnce({ refresh_token: 'r3' });

    const results = await Promise.all([
      queueRefreshGrant(instance, 'r1', grant),
      queueRefreshGrant(instance, 'r1', grant),
    ]);

    expect(grant.mock.calls.map(([token]) => token)).toEqual(['r1', 'r2']);
    expect(results.map((result) => result.refreshToken)).toEqual(['r2', 'r3']);
  });

  it('keeps the refresh token when the server does not rotate it', async () => {
    const grant = vi.fn().mockResolvedValue({});

    await expect(queueRefreshGrant(instance, 'r1', grant)).resolves.toEqual({
      tokens: {},
      refreshToken: 'r1',
    });
  });

  it('reuses a rotated refresh token for a stale cookie during the grace window', async () => {
    const grant = vi
      .fn()
      .mockResolvedValueOnce({ refresh_token: 'r2' })
      .mockResolvedValueOnce({});

    await queueRefreshGrant(instance, 'r1', grant);
    await queueRefreshGrant(instance, 'r1', grant);

    expect(grant.mock.calls.map(([token]) => token)).toEqual(['r1', 'r2']);
  });

  it('shares the queue between old and rotated refresh tokens', async () => {
    const grant = vi
      .fn()
      .mockResolvedValueOnce({ refresh_token: 'r2' })
      .mockResolvedValueOnce({ refresh_token: 'r3' })
      .mockResolvedValueOnce({});

    await queueRefreshGrant(instance, 'r1', grant);
    await Promise.all([
      queueRefreshGrant(instance, 'r1', grant),
      queueRefreshGrant(instance, 'r2', grant),
    ]);

    expect(grant.mock.calls.map(([token]) => token)).toEqual([
      'r1',
      'r2',
      'r3',
    ]);
  });

  it('forgets rotated refresh tokens after the grace window', async () => {
    const grant = vi
      .fn()
      .mockResolvedValueOnce({ refresh_token: 'r2' })
      .mockResolvedValueOnce({});

    await queueRefreshGrant(instance, 'r1', grant);
    await vi.advanceTimersByTimeAsync(
      REFRESH_TOKEN_ROTATION_GRACE_SECONDS * 1000,
    );
    await queueRefreshGrant(instance, 'r1', grant);

    expect(grant.mock.calls.map(([token]) => token)).toEqual(['r1', 'r1']);
  });

  it('continues with the previous refresh token after a failed grant', async () => {
    const grant = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});

    const results = await Promise.allSettled([
      queueRefreshGrant(instance, 'r1', grant),
      queueRefreshGrant(instance, 'r1', grant),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'fulfilled',
    ]);
    expect(grant.mock.calls.map(([token]) => token)).toEqual(['r1', 'r1']);
  });

  it('keeps queues separate per instance', async () => {
    const grant = vi
      .fn()
      .mockResolvedValueOnce({ refresh_token: 'r2' })
      .mockResolvedValueOnce({});

    await queueRefreshGrant(instance, 'r1', grant);
    await queueRefreshGrant({ config: {} as never }, 'r1', grant);

    expect(grant.mock.calls.map(([token]) => token)).toEqual(['r1', 'r1']);
  });
});
