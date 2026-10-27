import { Bot } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { TEXTS } from './texts';
import type { BotCore } from './types';

/**
 * The bot's own identity, built from the token and the configured username. Passing it up front saves the
 * `getMe` request grammY would otherwise make on every cold start of the Worker.
 */
const botInfoFor = (token: string, username: string): UserFromGetMe =>
  ({ id: Number(token.split(':')[0]), is_bot: true, first_name: username, username }) as UserFromGetMe;

/** Wires the bot's behaviour to Telegram commands. */
export const createBot = (token: string, username: string, core: BotCore, apiRoot?: string): Bot => {
  const bot = new Bot(token, { botInfo: botInfoFor(token, username), ...(apiRoot ? { client: { apiRoot } } : {}) });

  bot.command('start', async (ctx) => ctx.reply(await core.start(ctx.chat.id, ctx.match)));
  bot.command('stop', async (ctx) => ctx.reply(await core.stop(ctx.chat.id)));
  bot.command('status', async (ctx) => ctx.reply(await core.status(ctx.chat.id)));
  bot.command('help', (ctx) => ctx.reply(core.help()));
  bot.callbackQuery(/^(done|snooze):(.+)$/, async (ctx) => {
    const [, action, key] = ctx.match;
    const chatId = ctx.chat?.id;
    const answer = chatId ? await core.taskAction(chatId, action as 'done' | 'snooze', key) : TEXTS.taskGone;
    await ctx.answerCallbackQuery({ text: answer });
    // Remove the buttons so the same reminder cannot be pressed twice.
    await ctx.editMessageReplyMarkup().catch(() => undefined);
  });
  bot.on('message', (ctx) => ctx.reply(TEXTS.unknown));

  return bot;
};
