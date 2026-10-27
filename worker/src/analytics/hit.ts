import { ANALYTICS } from '../config';
import { localDayHour } from '../lib/local-time';
import { sha256Hex } from '../lib/token-crypto';
import type { AnalyticsRepo } from '../types';

const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export interface HitDeps {
  repo: AnalyticsRepo;
  now?: () => number;
}

/** True when the browser asks not to be tracked (Do Not Track or Global Privacy Control). */
const optedOut = (request: Request): boolean => request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1';

/**
 * POST /api/hit: counts one anonymous event. Stores only the day, the hour, a hash of the browser's random id and
 * the event name: never the IP address or the user agent. Opt-outs, crawlers and unknown events are answered
 * with 204 and ignored, so a page never sees an error because of statistics.
 */
export const handleHit = async (request: Request, deps: HitDeps): Promise<Response> => {
  if (optedOut(request)) return new Response(null, { status: 204 });
  const agent = request.headers.get('User-Agent') ?? '';
  if (!agent || ANALYTICS.botPattern.test(agent)) return new Response(null, { status: 204 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const { id, event } = (body ?? {}) as { id?: unknown; event?: unknown };
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return new Response(null, { status: 400 });
  if (typeof event !== 'string' || !(ANALYTICS.clientEvents as readonly string[]).includes(event)) return new Response(null, { status: 204 });

  try {
    const visitor = (await sha256Hex(id)).slice(0, 16);
    const { day, hour } = localDayHour((deps.now ?? (() => Math.floor(Date.now() / 1000)))(), ANALYTICS.timeZone);
    await deps.repo.record(event, visitor, 1, day, hour);
  } catch {
    /* statistics are best effort */
  }
  return new Response(null, { status: 204 });
};
