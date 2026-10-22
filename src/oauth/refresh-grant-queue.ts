import type { MondoInstance } from '../core/instance';

/**
 * Seconds a rotated refresh token is remembered after its grants settle, so a
 * request that still carries the previous token in its cookie can use it.
 */
export const REFRESH_TOKEN_ROTATION_GRACE_SECONDS = 30;

/**
 * Refresh tokens issued from one another, sharing the latest one.
 */
type RefreshTokenLineage = {
  /** Resolves to the newest refresh token once queued grants settle. */
  latest: Promise<string>;

  /** Every refresh token in the lineage, used as a queue key. */
  keys: Set<string>;
};

type RefreshGrantQueue = Map<string, RefreshTokenLineage>;

const queues = new WeakMap<MondoInstance, RefreshGrantQueue>();

/**
 * Runs refresh grants for one refresh token one at a time.
 *
 * When the server rotates refresh tokens, two concurrent grants with the same
 * token would make the second fail with `invalid_grant`. Queued grants instead
 * use the refresh token the previous grant returned. This only coordinates
 * requests handled by the same server instance.
 *
 * @param instance - Auth client instance that owns the queue.
 * @param refreshToken - Refresh token stored in the caller's session.
 * @param grant - Performs the refresh grant with the token to use.
 * @returns The grant's tokens and the refresh token to persist.
 */
export async function queueRefreshGrant<
  Tokens extends { refresh_token?: string },
>(
  instance: MondoInstance,
  refreshToken: string,
  grant: (refreshToken: string) => Promise<Tokens>,
): Promise<{ tokens: Tokens; refreshToken: string }> {
  const queue = getQueue(instance);
  const lineage = queue.get(refreshToken) ?? {
    latest: Promise.resolve(refreshToken),
    keys: new Set([refreshToken]),
  };
  queue.set(refreshToken, lineage);

  const previous = lineage.latest;
  const result = previous.then(async (current) => {
    const tokens = await grant(current);
    const next = tokens.refresh_token ?? current;

    lineage.keys.add(next);
    queue.set(next, lineage);

    return { tokens, refreshToken: next };
  });

  const latest = result.then(
    ({ refreshToken: next }) => next,
    () => previous,
  );
  lineage.latest = latest;

  void latest.then(() => {
    const timer = setTimeout(() => {
      if (lineage.latest !== latest) {
        return;
      }

      for (const key of lineage.keys) {
        if (queue.get(key) === lineage) {
          queue.delete(key);
        }
      }
    }, REFRESH_TOKEN_ROTATION_GRACE_SECONDS * 1000);
    timer.unref?.();
  });

  return result;
}

function getQueue(instance: MondoInstance): RefreshGrantQueue {
  let queue = queues.get(instance);
  if (!queue) {
    queue = new Map();
    queues.set(instance, queue);
  }

  return queue;
}
