import { NextResponse } from 'next/server.js';
import type { MondoInstance } from '../core/instance';
import type { Session } from '../session/model';
import { sessionStoreFactory } from '../session/stores/stateless-store';
import type { SessionStoreInterface } from '../session/stores/types';
import type { Claims } from '../session/types';

export interface SessionOptions<UserClaims extends Claims = Claims> {
  /**
   * Whether this route should also roll the session expiry forward.
   *
   * Defaults to `true`.
   */
  touch?: boolean;

  /**
   * Transform the session prior to returning it
   *
   * @param session - Current session, or `undefined` when missing or expired.
   */
  transform?: (session: Session<UserClaims> | undefined) => unknown;
}

/**
 * Builds a route handler for the configured session route.
 */
export type SessionHandler<UserClaims extends Claims = Claims> = (
  options?: SessionOptions<UserClaims>,
) => (req: Request) => Promise<Response>;

/**
 * Creates a session handler bound to one auth client instance.
 *
 * The returned handler reads the sealed session cookies and returns JSON, or a
 * 401 response when the session is missing or expired.
 *
 * @param instance - Validated auth client instance.
 */
export const sessionHandlerFactory =
  <UserClaims extends Claims>(instance: MondoInstance) =>
  (options?: SessionOptions<UserClaims>) =>
  async (_req: Request): Promise<Response> => {
    return await handler<UserClaims>(
      sessionStoreFactory<UserClaims>(instance.config),
      options,
    );
  };

async function handler<UserClaims extends Claims>(
  sessionStore: SessionStoreInterface<UserClaims>,
  options?: SessionOptions<UserClaims>,
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
