import { Bot } from 'grammy';
import { TEXTS } from './texts';
import type { BotCore } from './types';

/** Wires the bot's behaviour to Telegram commands. */
export const createBot = (token: string, core: BotCore): Bot => {
  const bot = new Bot(token);

  bot.command('start', async (ctx) => ctx.reply(await core.start(ctx.chat.id, ctx.match)));
  bot.command('stop', async (ctx) => ctx.reply(await core.stop(ctx.chat.id)));
  bot.command('status', async (ctx) => ctx.reply(await core.status(ctx.chat.id)));
  bot.command('help', (ctx) => ctx.reply(core.help()));
  bot.on('message', (ctx) => ctx.reply(TEXTS.unknown));

  return bot;
};
