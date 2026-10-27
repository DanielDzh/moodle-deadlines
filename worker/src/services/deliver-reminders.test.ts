import { describe, expect, it } from 'vitest';
import { sentKey } from '../lib/reminder-planner';
import { kyiv } from '../lib/test-time';
import type { PlannedReminder, PlannerTask } from '../types';
import type { SendResult, TelegramClient } from '../telegram/telegram-api';
import { deliverReminders, type DeliveryRepo, type UserBatch } from './deliver-reminders';

const NOW = kyiv(27, 14, 0);
const task = (key: string, due: number, over: Partial<PlannerTask> = {}): PlannerTask => ({
  key, name: key, course: 'C', url: '', due, done: false, submitted: false, muted: false, snoozeUntil: 0, ...over,
});
const batch = (userId: string, tasks: PlannerTask[], sent: string[] = []): UserBatch => ({ userId, chatId: Number(userId.replace(/\D/g, '')) || 1, tz: 'Europe/Kyiv', tasks, sent: new Set(sent) });

const setup = (batches: UserBatch[], respond: (chatId: number, n: number) => SendResult = () => ({ ok: true })) => {
  const marked: string[] = [];
  const removed: string[] = [];
  const messages: { chatId: number; text: string }[] = [];
  const repo: DeliveryRepo = {
    loadBatches: async () => batches,
    markSent: async (userId, r: PlannedReminder) => void marked.push(`${userId}:${r.task.key}:${r.kind}`),
    deleteUser: async (userId) => void removed.push(userId),
  };
  const telegram: TelegramClient = {
    sendMessage: async (chatId, text) => {
      messages.push({ chatId, text });
      return respond(chatId, messages.length);
    },
  };
  return { repo, telegram, marked, removed, messages };
};

describe('deliverReminders', () => {
  it('sends a due reminder and marks it only after Telegram accepted it', async () => {
    const s = setup([batch('u1', [task('a', NOW + 24 * 3600)])]);
    const report = await deliverReminders(s.repo, s.telegram, NOW);
    expect(report).toEqual({ sent: 1, removed: 0, failed: 0, rateLimited: false });
    expect(s.marked).toEqual(['u1:a:24h']);
    expect(s.messages[0].text).toContain('⏰ До дедлайну 1 д');
  });

  it('does nothing when nothing is due or it was already sent', async () => {
    const due = NOW + 24 * 3600;
    const s = setup([batch('u1', [task('a', NOW + 30 * 3600), task('b', due)], [sentKey('b', due, '24h')])]);
    expect(await deliverReminders(s.repo, s.telegram, NOW)).toMatchObject({ sent: 0 });
    expect(s.messages).toEqual([]);
  });

  it('does not mark a reminder that failed, so it is retried next tick', async () => {
    const s = setup([batch('u1', [task('a', NOW + 24 * 3600), task('b', NOW + 25 * 3600)])], () => ({ ok: false, reason: 'error' }));
    const report = await deliverReminders(s.repo, s.telegram, NOW);
    expect(report).toMatchObject({ sent: 0, failed: 1 });
    expect(s.marked).toEqual([]);
    expect(s.messages).toHaveLength(1); // stops hammering that chat
  });

  it('removes the user\'s data when the bot was blocked', async () => {
    const s = setup([batch('u1', [task('a', NOW + 24 * 3600)])], () => ({ ok: false, reason: 'blocked' }));
    expect(await deliverReminders(s.repo, s.telegram, NOW)).toMatchObject({ removed: 1 });
    expect(s.removed).toEqual(['u1']);
  });

  it('stops everything on a rate limit', async () => {
    const s = setup([batch('u1', [task('a', NOW + 24 * 3600)]), batch('u2', [task('b', NOW + 24 * 3600)])], () => ({ ok: false, reason: 'rate_limited', retryAfter: 5 }));
    const report = await deliverReminders(s.repo, s.telegram, NOW);
    expect(report.rateLimited).toBe(true);
    expect(s.messages).toHaveLength(1);
  });

  it('caps reminders per user per tick, earliest deadline first', async () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task(`t${i}`, NOW + 24 * 3600 - (8 - i) * 60));
    const s = setup([batch('u1', tasks)]);
    await deliverReminders(s.repo, s.telegram, NOW);
    expect(s.marked).toHaveLength(5);
    expect(s.marked[0]).toBe('u1:t0:24h');
  });

  it('keeps going for other users when one has nothing to send', async () => {
    const s = setup([batch('u1', []), batch('u2', [task('a', NOW + 24 * 3600)])]);
    expect(await deliverReminders(s.repo, s.telegram, NOW)).toMatchObject({ sent: 1 });
  });
});
