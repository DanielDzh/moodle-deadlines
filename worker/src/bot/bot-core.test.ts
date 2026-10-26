import { describe, expect, it } from 'vitest';
import { createBotCore } from './bot-core';
import { TEXTS } from './texts';
import type { BotRepo } from './types';

const NOW = 1_800_000_000;

/** In-memory storage with the same rules as the D1 one. */
const memoryRepo = (codes: Record<string, number> = {}) => {
  const chats = new Map<number, number>(); // chatId → task count
  const used = new Set<string>();
  const repo: BotRepo = {
    bindChat: async (code, chatId, now) => {
      const expires = codes[code];
      if (expires === undefined || expires <= now || used.has(code)) return false;
      used.add(code);
      chats.set(chatId, 3);
      return true;
    },
    deleteByChat: async (chatId) => chats.delete(chatId),
    trackedTasks: async (chatId) => chats.get(chatId) ?? null,
  };
  return { repo, chats };
};

describe('bot behaviour', () => {
  it('/start without a code explains how to connect', async () => {
    const core = createBotCore(memoryRepo().repo, () => NOW);
    expect(await core.start(1, '')).toBe(TEXTS.startNoCode);
    expect(await core.start(1, '   ')).toBe(TEXTS.startNoCode);
  });

  it('/start with a valid code links the chat', async () => {
    const { repo, chats } = memoryRepo({ ABCDEFGH23: NOW + 600 });
    const core = createBotCore(repo, () => NOW);
    expect(await core.start(7, 'ABCDEFGH23')).toBe(TEXTS.linked);
    expect(chats.has(7)).toBe(true);
  });

  it('rejects unknown, expired, reused and malformed codes', async () => {
    const { repo } = memoryRepo({ GOODCODE12: NOW + 600, OLDCODE123: NOW - 1 });
    const core = createBotCore(repo, () => NOW);
    expect(await core.start(1, 'NOSUCHCODE')).toBe(TEXTS.invalidCode);
    expect(await core.start(1, 'OLDCODE123')).toBe(TEXTS.invalidCode);
    expect(await core.start(1, 'bad code!')).toBe(TEXTS.invalidCode);
    expect(await core.start(1, 'x'.repeat(200))).toBe(TEXTS.invalidCode);
    expect(await core.start(1, 'GOODCODE12')).toBe(TEXTS.linked);
    expect(await core.start(2, 'GOODCODE12')).toBe(TEXTS.invalidCode);
  });

  it('/stop deletes the data only when the chat was linked', async () => {
    const { repo, chats } = memoryRepo({ GOODCODE12: NOW + 600 });
    const core = createBotCore(repo, () => NOW);
    expect(await core.stop(5)).toBe(TEXTS.stopNothing);
    await core.start(5, 'GOODCODE12');
    expect(await core.stop(5)).toBe(TEXTS.stopped);
    expect(chats.has(5)).toBe(false);
  });

  it('/status reports the tracked task count or that nothing is linked', async () => {
    const { repo } = memoryRepo({ GOODCODE12: NOW + 600 });
    const core = createBotCore(repo, () => NOW);
    expect(await core.status(9)).toBe(TEXTS.statusNotLinked);
    await core.start(9, 'GOODCODE12');
    expect(await core.status(9)).toBe(TEXTS.statusLinked(3));
  });

  it('/help lists the commands', () => {
    const core = createBotCore(memoryRepo().repo);
    expect(core.help()).toContain('/stop');
    expect(core.help()).toContain('/status');
  });
});
