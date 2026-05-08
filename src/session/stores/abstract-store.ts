import type { Config } from '../../config/types';
import { assertBoolean } from '../assert';
import type { Session } from '../model';
import type { Claims } from '../types';
import { epoch } from '../utils';
import type { SessionStoreInterface } from './types';

/**
 * Base session store behavior shared by concrete storage implementations.
 *
 * The base class enforces absolute and idle expiry before returning a session.
 */
export abstract class AbstractSessionStore<UserClaims extends Claims = Claims>
  implements SessionStoreInterface<UserClaims>
{
  constructor(protected readonly config: Config) {}

  protected abstract _get(): Promise<Session<UserClaims> | undefined>;
  protected abstract _set(session: Session<UserClaims>): Promise<void>;
  protected abstract _delete(): Promise<void>;

  /**
   * Reads and validates the current session.
   *
   * @returns The session, or `undefined` when missing, expired, or malformed.
   */
  public async get(): Promise<Session<UserClaims> | undefined> {
    const { absoluteDuration, idleDuration } = this.config.session;
    const now = epoch();

    try {
      const session = await this._get();

      if (session) {
        assertBoolean(
          session.expiresAt > now,
          'it is expired based on the effective session expiry',
        );

        if (idleDuration !== false) {
          assertBoolean(
            session.updatedAt + idleDuration > now,
            'it is expired based on current idleDuration rules',
          );
        }

        if (absoluteDuration !== false) {
          assertBoolean(
            session.issuedAt + absoluteDuration > now,
            'it is expired based on current absoluteDuration rules',
          );
        }

        return session;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  /**
   * Persists a complete session.
   */
  async set(session: Session<UserClaims>): Promise<void> {
    session.expiresAt = calculateExp(session.updatedAt, this.config, {
      issuedAt: session.issuedAt,
    });
    await this._set(session);
  }

  /**
   * Clears the session from the backing store.
   */
  async delete(): Promise<void> {
    await this._delete();
  }

  /**
   * Updates idle expiry timestamps and persists the session.
   *
   * When idle sessions are disabled, this returns the current session
   * without modifying cookies.
   */
  async touch(): Promise<Session<UserClaims> | undefined> {
    const session = await this.get();
    if (!session) {
      return;
    }

    if (this.config.session.idleDuration === false) {
      return session;
    }

    const updatedAt = epoch();
    const expiresAt = calculateExp(updatedAt, this.config, {
      issuedAt: session.issuedAt,
    });

    session.updatedAt = updatedAt;
    session.expiresAt = expiresAt;

    await this.set(session);

    return session;
  }
}

function calculateExp(
  updatedAt: number,
  config: Config,
  session: Pick<Session, 'issuedAt'>,
): number {
  const { absoluteDuration, idleDuration } = config.session;
  const candidates: number[] = [];

  if (idleDuration !== false) {
    candidates.push(updatedAt + idleDuration);
  }

  if (absoluteDuration !== false) {
    candidates.push(session.issuedAt + absoluteDuration);
  }

  return Math.min(...candidates);
}
