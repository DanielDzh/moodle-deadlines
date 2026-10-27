import { webhookCallback } from 'grammy';
import { createBot } from './bot/create-bot';
import { createBotCore } from './bot/bot-core';
import { createUsersRepo } from './db/users-repo';
import { handleApi } from './api/handlers';
import { createApiRepo } from './db/api-repo';
import { corsHeadersFor, parseOrigins } from './lib/cors';
import { parseBlockedSites } from './lib/site-url';
import { secretsMatch } from './lib/secure-compare';
import { runScheduled } from './services/scheduled';
import type { Env } from './types';

const WEBHOOK_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

/** Telegram webhook: only requests carrying our secret header are passed to the bot. */
const handleTelegram = async (request: Request, env: Env): Promise<Response> => {
  const provided = request.headers.get(WEBHOOK_SECRET_HEADER) ?? '';
  if (!provided || !(await secretsMatch(provided, env.TELEGRAM_WEBHOOK_SECRET))) {
    return new Response('Unauthorized', { status: 401 });
  }
  const bot = createBot(env.TELEGRAM_BOT_TOKEN, env.BOT_USERNAME, createBotCore(createUsersRepo(env.DB)), env.TELEGRAM_API_BASE);
  return webhookCallback(bot, 'cloudflare-mod')(request);
};

/** The site API with CORS: only the configured site origins may call it from a browser. */
const handleSiteApi = async (request: Request, env: Env): Promise<Response> => {
  const cors = corsHeadersFor(request, parseOrigins(env.ALLOWED_ORIGINS));
  if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
  if (request.headers.has('Origin') && !cors) return new Response('Forbidden', { status: 403 });
  const response = await handleApi(request, {
    repo: createApiRepo(env.DB),
    tokenKey: env.TOKEN_KEY,
    botUsername: env.BOT_USERNAME,
    blockedSites: parseBlockedSites(env.BLOCKED_SITES),
    siteCheck: env.DEV_ALLOW_ANY_SITE === '1' ? (input) => ({ ok: true, site: String(input).replace(/\/+$/, '') }) : undefined,
  });
  for (const [name, value] of Object.entries(cors ?? {})) response.headers.set(name, value);
  return response;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return new Response('ok');
    if (pathname === '/telegram' && request.method === 'POST') return handleTelegram(request, env);
    if (pathname.startsWith('/api/')) return handleSiteApi(request, env);
    return new Response('Not found', { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await runScheduled(env);
  },
} satisfies ExportedHandler<Env>;
