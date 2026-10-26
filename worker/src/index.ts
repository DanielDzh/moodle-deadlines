import { webhookCallback } from 'grammy';
import { createBot } from './bot/create-bot';
import { createBotCore } from './bot/bot-core';
import { createUsersRepo } from './db/users-repo';
import { secretsMatch } from './lib/secure-compare';
import type { Env } from './types';

const WEBHOOK_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

/** Telegram webhook: only requests carrying our secret header are passed to the bot. */
const handleTelegram = async (request: Request, env: Env): Promise<Response> => {
  const provided = request.headers.get(WEBHOOK_SECRET_HEADER) ?? '';
  if (!provided || !(await secretsMatch(provided, env.TELEGRAM_WEBHOOK_SECRET))) {
    return new Response('Unauthorized', { status: 401 });
  }
  const bot = createBot(env.TELEGRAM_BOT_TOKEN, createBotCore(createUsersRepo(env.DB)));
  return webhookCallback(bot, 'cloudflare-mod')(request);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return new Response('ok');
    if (pathname === '/telegram' && request.method === 'POST') return handleTelegram(request, env);
    return new Response('Not found', { status: 404 });
  },

  async scheduled(_event: ScheduledController, _env: Env): Promise<void> {
    // Sending reminders and refreshing data from Moodle: stage 4.
  },
} satisfies ExportedHandler<Env>;
