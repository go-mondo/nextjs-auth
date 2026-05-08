import type { Session } from '../model';
import type { Claims } from '../types';

export interface SessionStoreInterface<UserClaims extends Claims> {
  get(): Promise<Session<UserClaims> | undefined>;
  set(session: Session<UserClaims>): Promise<void>;
  delete(): Promise<void>;
  touch(): Promise<Session<UserClaims> | undefined>;
}
