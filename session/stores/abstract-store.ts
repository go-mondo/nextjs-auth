import type { Config } from '../../config/types';
import { assertBoolean } from '../../utils/assert';
import type Session from '../model';
import type { Claims } from '../types';
import { epoch } from '../utils';
import type { SessionStoreInterface } from './types';

export abstract class AbstractSessionStore<
  UserClaims extends Claims = { [key: string]: any },
> implements SessionStoreInterface<UserClaims>
{
  constructor(protected readonly config: Config) {}

  protected abstract _get(): Promise<Session<UserClaims> | undefined>;
  protected abstract _set(session: Session<UserClaims>): Promise<void>;
  protected abstract _delete(): Promise<void>;

  /**
   * @param request
   * @param response
   * @returns
   */
  public async get(): Promise<Session<UserClaims> | undefined> {
    const { duration } = this.config.session;

    try {
      const session = await this._get();

      if (session) {
        // check that the session isn't expired based
        assertBoolean(
          session.expiresAt > epoch(),
          'it is expired based on options when it was established'
        );

        // check that the existing session isn't expired based on current rollingDuration rules
        if (duration) {
          assertBoolean(
            session.updatedAt + duration > epoch(),
            'it is expired based on current rollingDuration rules'
          );
        }

        return session;
      }
    } catch (err) {
      // debug('error handling session %O', err);
    }

    return undefined;
  }

  async set(session: Session<UserClaims>): Promise<void> {
    await this._set(session);
  }

  async delete(): Promise<void> {
    await this._delete();
  }

  async touch(): Promise<Session<UserClaims> | undefined> {
    const session = await this.get();
    if (!session) {
      return;
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

  return uat + (duration as number);
}
