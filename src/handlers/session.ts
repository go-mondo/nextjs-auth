import { NextResponse } from 'next/server.js';
import type { MondoInstance } from '../init';
import type Session from '../session/model';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type { SessionStoreInterface } from '../session/stores/types';
import type { Claims } from '../session/types';

export interface SessionOptions<UserClaims extends Claims = Claims> {
  /**
   * Specify whether the request should also 'touch' the session
   */
  touch?: boolean;

  /**
   * URL to return to after Session. Overrides the default in {@link BaseConfig.baseURL}.
   */
  returnTo?: string;

  /**
   * Transform the session prior to returning it
   *
   * @param session
   * @returns
   */
  transform?: (session: Session<UserClaims> | undefined) => unknown;
}

export type SessionHandler = (
  options?: SessionOptions,
) => (req: Request) => Promise<Response>;

/**
 * Create a new Session handler
 *
 * @param instance
 * @returns
 */
export const sessionHandlerFactory =
  <UserClaims extends Claims>(instance: MondoInstance) =>
  (options?: SessionOptions) =>
  async (_req: Request): Promise<Response> => {
    return await handler<UserClaims>(
      sessionStoreFactory<UserClaims>(instance.config),
      options,
    );
  };

async function handler<UserClaims extends Claims>(
  sessionStore: SessionStoreInterface<UserClaims>,
  options?: SessionOptions,
): Promise<Response> {
  const session = await (options?.touch !== false
    ? sessionStore.touch()
    : sessionStore.get());

  const result = options?.transform ? options?.transform(session) : session;

  if (!result) {
    return Response.json(
      {
        error: 'SessionNotFound',
        error_description: 'Session does not exist or has expired',
      },
      { status: 401, statusText: 'Unauthorized' },
    );
  }

  return NextResponse.json(result);
}
