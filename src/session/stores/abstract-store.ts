import type { Config } from '../../config/types';
import { assertBoolean } from '../assert';
import type { Session } from '../model';
import type { Claims } from '../types';
import { epoch } from '../utils';
import type { SessionStoreInterface } from './types';

/**
 * Base session store behavior shared by concrete storage implementations.
 *
 * The base class enforces absolute and rolling expiry before returning a
 * session.
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
    const { duration } = this.config.session;

    try {
      const session = await this._get();

      if (session) {
        assertBoolean(
          session.expiresAt > epoch(),
          'it is expired based on options when it was established',
        );

        if (duration) {
          assertBoolean(
            session.updatedAt + duration > epoch(),
            'it is expired based on current rollingDuration rules',
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
    await this._set(session);
  }

  /**
   * Clears the session from the backing store.
   */
  async delete(): Promise<void> {
    await this._delete();
  }

  /**
   * Updates rolling expiry timestamps and persists the session.
   *
   * When rolling sessions are disabled, this returns the current session
   * without modifying cookies.
   */
  async touch(): Promise<Session<UserClaims> | undefined> {
    const session = await this.get();
    if (!session) {
      return;
    }

    if (this.config.session.duration === false) {
      return session;
    }

    const updatedAt = epoch();
    const expiresAt = calculateExp(updatedAt, this.config);

    session.updatedAt = updatedAt;
    session.expiresAt = expiresAt;

    await this.set(session);

    return session;
  }
}

function calculateExp(uat: number, config: Config): number {
  const { duration } = config.session;
  if (duration === false) {
    return uat;
  }

  return uat + duration;
}
