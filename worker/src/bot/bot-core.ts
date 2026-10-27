import { DELIVERY } from '../config';
import { TEXTS } from './texts';
import type { BotCore, BotRepo } from './types';

/** One-time link codes are short URL-safe strings; anything else is rejected before touching the database. */
const CODE_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** The bot's behaviour without any Telegram or D1 specifics, so it can be tested directly. */
export const createBotCore = (repo: BotRepo, clock: () => number = () => Math.floor(Date.now() / 1000)): BotCore => ({
  start: async (chatId, payload) => {
    const code = payload.trim();
    if (!code) return TEXTS.startNoCode;
    if (!CODE_PATTERN.test(code)) return TEXTS.invalidCode;
    return (await repo.bindChat(code, chatId, clock())) ? TEXTS.linked : TEXTS.invalidCode;
  },

  stop: async (chatId) => ((await repo.deleteByChat(chatId)) ? TEXTS.stopped : TEXTS.stopNothing),

  status: async (chatId) => {
    const count = await repo.trackedTasks(chatId, clock());
    return count === null ? TEXTS.statusNotLinked : TEXTS.statusLinked(count);
  },

  help: () => TEXTS.help,

  taskAction: async (chatId, action, taskKey) => {
    const ok = action === 'done' ? await repo.muteTask(chatId, taskKey) : await repo.snoozeTask(chatId, taskKey, clock() + DELIVERY.snoozeSec);
    if (!ok) return TEXTS.taskGone;
    return action === 'done' ? TEXTS.taskDone : TEXTS.taskSnoozed;
  },
});
