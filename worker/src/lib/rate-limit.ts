import { RATE_LIMITS } from '../config';
import type { RateLimitRepo } from '../types';
import { sha256Hex } from './token-crypto';

/** The client address Cloudflare saw, or null when there is none (local development). */
export const clientAddress = (request: Request): string | null => request.headers.get('CF-Connecting-IP');

/**
 * A bucket name for (route, address, hour): a keyed hash, so the address is never stored and the bucket
 * is meaningless without the secret. A new hour gives a new bucket, which also resets the count.
 */
export const bucketFor = async (secret: string, route: string, address: string, windowStart: number): Promise<string> =>
  (await sha256Hex(`${secret}|${route}|${address}|${windowStart}`)).slice(0, 16);

export interface Limited {
  limited: true;
  /** Seconds until the next window starts. */
  retryAfter: number;
}

/**
 * Counts this request and says whether the client is over the limit. Fails open: if the counter cannot be
 * written the request is allowed, because a broken limiter must not take the feature down with it.
 */
export const enforceLimit = async (
  repo: RateLimitRepo,
  request: Request,
  { secret, route, limit, now }: { secret: string; route: string; limit: number; now: number },
): Promise<Limited | null> => {
  const address = clientAddress(request);
  if (!address) return null;
  const window = now - (now % RATE_LIMITS.windowSec);
  try {
    const count = await repo.hit(await bucketFor(secret, route, address, window), window);
    return count > limit ? { limited: true, retryAfter: window + RATE_LIMITS.windowSec - now } : null;
  } catch {
    return null;
  }
};
