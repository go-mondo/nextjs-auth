import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../../config/types';
import { createTestConfig } from '../../test-utils';
import { Session } from '../model';
import type { Claims } from '../types';
import { epoch } from '../utils';
import { AbstractSessionStore } from './abstract-store';

class MemorySessionStore<
  UserClaims extends Claims = Claims,
> extends AbstractSessionStore<UserClaims> {
  constructor(
    config: Config,
    private session: Session<UserClaims> | undefined,
  ) {
    super(config);
  }

  protected async _get(): Promise<Session<UserClaims> | undefined> {
    return this.session;
  }

  protected async _set(session: Session<UserClaims>): Promise<void> {
    this.session = session;
  }

  protected async _delete(): Promise<void> {
    this.session = undefined;
  }
}

describe('AbstractSessionStore', () => {
  it('returns valid sessions', async () => {
    const session = createSession();
    const store = new MemorySessionStore(createTestConfig(), session);

    await expect(store.get()).resolves.toBe(session);
  });

  it('hides expired sessions', async () => {
    const store = new MemorySessionStore(
      createTestConfig(),
      createSession({ expiresAt: epoch() - 1 }),
    );

    await expect(store.get()).resolves.toBeUndefined();
  });

  it('hides sessions past rolling duration', async () => {
    const store = new MemorySessionStore(
      createTestConfig({ session: { duration: 60 } }),
      createSession({ updatedAt: epoch() - 61, expiresAt: epoch() + 3600 }),
    );

    await expect(store.get()).resolves.toBeUndefined();
  });

  it('ignores rolling expiry when session duration is disabled', async () => {
    const session = createSession({
      updatedAt: epoch() - 10_000,
      expiresAt: epoch() + 3600,
    });
    const store = new MemorySessionStore(
      createTestConfig({ session: { duration: false } }),
      session,
    );

    await expect(store.get()).resolves.toBe(session);
  });

  it('touches sessions when rolling duration is enabled', async () => {
    const now = epoch();
    vi.useFakeTimers({ now: now * 1000 });
    const session = createSession({ updatedAt: now - 10, expiresAt: now + 50 });
    const store = new MemorySessionStore(
      createTestConfig({ session: { duration: 60 } }),
      session,
    );

    await expect(store.touch()).resolves.toBe(session);

    expect(session.updatedAt).toBe(now);
    expect(session.expiresAt).toBe(now + 60);
    vi.useRealTimers();
  });

  it('does not touch sessions when rolling duration is disabled', async () => {
    const session = createSession();
    const original = {
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
    };
    const store = new MemorySessionStore(
      createTestConfig({ session: { duration: false } }),
      session,
    );

    await expect(store.touch()).resolves.toBe(session);
    expect(session).toMatchObject(original);
  });
});

function createSession(
  overrides: Partial<ConstructorParameters<typeof Session>[0]> = {},
) {
  const now = epoch();

  return new Session({
    user: { tnt: 'tenant', sub: 'user_123' },
    issuedAt: now,
    updatedAt: now,
    expiresAt: now + 3600,
    ...overrides,
  });
}
