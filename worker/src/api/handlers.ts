import { LINK_CODE_TTL_SEC, LIMITS } from '../config';
import { generateLinkCode, generateUserId } from '../lib/link-code';
import { parseBearer, parseLinkStart, parseSync } from '../lib/request-parsing';
import { checkMoodleSite } from '../lib/site-url';
import { encryptToken, sha256Hex } from '../lib/token-crypto';
import type { ApiRepo, LinkState, SiteCheck, Tracker } from '../types';

export interface ApiDeps {
  repo: ApiRepo;
  /** Base64 key that encrypts Moodle tokens. */
  tokenKey: string;
  botUsername: string;
  blockedSites: readonly string[];
  /** Replaces the Moodle address check. For local development only (see DEV_ALLOW_ANY_SITE); never set in production. */
  siteCheck?: (input: unknown) => SiteCheck;
  /** Counts anonymous statistics events. */
  track?: Tracker;
  now?: () => number;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
};

const stateOf = (status: string | undefined): LinkState => {
  if (status === 'active') return 'active';
  if (status === 'pending') return 'pending';
  if (status === 'paused_auth') return 'paused';
  return 'none';
};

/**
 * The site API: link a browser to Telegram, report the link state, push tasks, unlink.
 * Authentication is the browser's random sync key (only its hash is stored). Errors never echo user input,
 * and nothing here logs request bodies, because they contain the Moodle token.
 */
export const handleApi = async (request: Request, deps: ApiDeps): Promise<Response> => {
  const { pathname } = new URL(request.url);
  const now = (deps.now ?? (() => Math.floor(Date.now() / 1000)))();
  const route = `${request.method} ${pathname}`;

  try {
    if (route === 'POST /api/link/start') return await linkStart(request, deps, now);

    if (route === 'GET /api/link/status' || route === 'POST /api/sync' || route === 'POST /api/unlink') {
      const syncKey = parseBearer(request);
      if (!syncKey) return json({ error: 'unauthorized' }, 401);
      const keyHash = await sha256Hex(syncKey);
      const user = await deps.repo.findBySyncKeyHash(keyHash);

      if (route === 'GET /api/link/status') {
        const state = stateOf(user?.status);
        // The site merges these into its own "Виконано" ticks before it pushes, so a press in the bot is not overwritten.
        return json({ state, done: user && state === 'active' ? await deps.repo.doneKeys(user.id) : [] });
      }

      if (route === 'POST /api/unlink') {
        await deps.repo.deleteUsersBySyncKey(keyHash);
        if (user) await deps.track?.('reminders_unlinked');
        return json({ ok: true });
      }

      if (!user || user.status !== 'active') return json({ error: 'not_active', state: stateOf(user?.status) }, 409);
      const parsed = parseSync(await readJson(request));
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      const tracked = await deps.repo.replaceTasks(user.id, parsed.value, now);
      return json({ ok: true, tracked });
    }

    return json({ error: 'not_found' }, 404);
  } catch (error) {
    // Only the error class: a message could contain request data.
    console.error('api error', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'server_error' }, 500);
  }
};

const linkStart = async (request: Request, deps: ApiDeps, now: number): Promise<Response> => {
  const parsed = parseLinkStart(await readJson(request));
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const site = (deps.siteCheck ?? ((input) => checkMoodleSite(input, deps.blockedSites)))(parsed.value.site);
  if (!site.ok) return json({ error: site.reason }, 400);

  await deps.repo.deleteExpiredPending(now);
  if ((await deps.repo.pendingCount()) >= LIMITS.maxPendingUsers) return json({ error: 'busy' }, 503);

  const id = generateUserId();
  const code = generateLinkCode();
  const expires = now + LINK_CODE_TTL_SEC;
  const syncKeyHash = await sha256Hex(parsed.value.syncKey);
  // A new attempt replaces this browser's older unfinished ones, so they cannot pile up.
  await deps.repo.deletePendingBySyncKey(syncKeyHash);
  await deps.repo.createPending({
    id,
    code,
    expires,
    syncKeyHash,
    site: site.site,
    tokenEnc: await encryptToken(parsed.value.token, deps.tokenKey, id),
    tz: parsed.value.tz,
    now,
  });
  return json({ code, expiresAt: expires, botUrl: `https://t.me/${deps.botUsername}?start=${code}` });
};
