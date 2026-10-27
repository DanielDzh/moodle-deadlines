import { webhookCallback } from 'grammy';
import { handleApi } from './api/handlers';
import { createRateLimitRepo } from './db/rate-limit-repo';
import { enforceLimit } from './lib/rate-limit';
import { createAnalyticsRepo, createStatsRepo, createTracker } from './analytics/analytics-repo';
import { handleHit } from './analytics/hit';
import { buildStats } from './analytics/stats';
import { STATS_PAGE } from './analytics/stats-page';
import { createBotCore } from './bot/bot-core';
import { createBot } from './bot/create-bot';
import { createApiRepo } from './db/api-repo';
import { createUsersRepo } from './db/users-repo';
import { corsHeadersFor, parseOrigins } from './lib/cors';
import { devSiteCheck } from './lib/dev-site-check';
import { secretsMatch } from './lib/secure-compare';
import { parseBlockedSites } from './lib/site-url';
import { runScheduled } from './services/scheduled';
import { RATE_LIMITS } from './config';
import type { Env } from './types';

const WEBHOOK_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

/** Telegram webhook: only requests carrying our secret header are passed to the bot. */
const handleTelegram = async (request: Request, env: Env): Promise<Response> => {
  const provided = request.headers.get(WEBHOOK_SECRET_HEADER) ?? '';
  if (!provided || !(await secretsMatch(provided, env.TELEGRAM_WEBHOOK_SECRET))) {
    return new Response('Unauthorized', { status: 401 });
  }
  const track = createTracker(createAnalyticsRepo(env.DB));
  const bot = createBot(env.TELEGRAM_BOT_TOKEN, env.BOT_USERNAME, createBotCore(createUsersRepo(env.DB), undefined, track), env.TELEGRAM_API_BASE);
  return webhookCallback(bot, 'cloudflare-mod')(request);
};

/** Runs a browser-facing handler with CORS: only the configured site origins may call it. */
const withCors = async (request: Request, env: Env, handler: () => Promise<Response>): Promise<Response> => {
  const cors = corsHeadersFor(request, parseOrigins(env.ALLOWED_ORIGINS));
  if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
  if (request.headers.has('Origin') && !cors) return new Response('Forbidden', { status: 403 });
  const response = await handler();
  for (const [name, value] of Object.entries(cors ?? {})) response.headers.set(name, value);
  return response;
};

/** The 429 answer, with the time to wait. */
const tooMany = (retryAfter: number, body: string | null): Response =>
  body === null
    ? new Response(null, { status: 204 })
    : new Response(body, { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } });

/** Counts a request against its route's limit; a Response means "stop here". */
const limit = async (request: Request, env: Env, route: string, max: number, silent = false): Promise<Response | null> => {
  const over = await enforceLimit(createRateLimitRepo(env.DB), request, { secret: env.TOKEN_KEY, route, limit: max, now: Math.floor(Date.now() / 1000) });
  return over ? tooMany(over.retryAfter, silent ? null : JSON.stringify({ error: 'rate_limited' })) : null;
};

const handleSiteApi = (request: Request, env: Env): Promise<Response> =>
  withCors(request, env, async () => {
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/link/start') {
      const blocked = await limit(request, env, 'link-start', RATE_LIMITS.linkStart);
      if (blocked) return blocked;
    }
    return handleApi(request, {
      repo: createApiRepo(env.DB),
      tokenKey: env.TOKEN_KEY,
      botUsername: env.BOT_USERNAME,
      blockedSites: parseBlockedSites(env.BLOCKED_SITES),
      siteCheck: env.DEV_ALLOW_ANY_SITE === '1' ? devSiteCheck : undefined,
      track: createTracker(createAnalyticsRepo(env.DB)),
    });
  });

const handleStatsApi = async (request: Request, env: Env): Promise<Response> => {
  const key = parseBearerAny(request);
  if (!env.STATS_KEY || !key || !(await secretsMatch(key, env.STATS_KEY))) return new Response('Unauthorized', { status: 401 });
  const stats = await buildStats(createStatsRepo(env.DB), Math.floor(Date.now() / 1000));
  return new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};

/** The statistics key from `Authorization: Bearer <key>` (any non-empty token, unlike the site's sync key). */
const parseBearerAny = (request: Request): string | null => /^Bearer (\S{1,200})$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? null;

const STATS_PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  // The page is one self-contained document with inline script and style, and only talks to itself.
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return new Response('ok');
    if (pathname === '/telegram' && request.method === 'POST') return handleTelegram(request, env);
    if (pathname === '/stats' && request.method === 'GET') return new Response(STATS_PAGE, { headers: STATS_PAGE_HEADERS });
    if (pathname === '/api/stats' && request.method === 'GET') return handleStatsApi(request, env);
    if (pathname === '/api/hit') {
      return withCors(request, env, async () => {
        // Over the limit: answer 204 like a counted hit, so the page never sees an error because of statistics.
        const blocked = request.method === 'POST' ? await limit(request, env, 'hit', RATE_LIMITS.hit, true) : null;
        return blocked ?? handleHit(request, { repo: createAnalyticsRepo(env.DB) });
      });
    }
    if (pathname.startsWith('/api/')) return handleSiteApi(request, env);
    return new Response('Not found', { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await runScheduled(env);
  },
} satisfies ExportedHandler<Env>;
