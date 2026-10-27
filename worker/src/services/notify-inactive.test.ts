import { describe, expect, it } from 'vitest';
import { TEXTS } from '../bot/texts';
import type { SendResult } from '../telegram/telegram-api';
import { notifyInactive, type InactiveUser, type InactivityRepo } from './notify-inactive';

const DAY = 86_400;
const NOW = 1_800_000_000;
const SITE = 'https://site.example';

interface Row extends InactiveUser {
  lastSeen: number;
  warnedAt: number;
}

/** In-memory storage with the same selection rules as the SQL. */
const setup = (rows: Row[], respond: (chatId: number) => SendResult = () => ({ ok: true })) => {
  const users = new Map(rows.map((r) => [r.id, { ...r }]));
  const sent: { chatId: number; text: string }[] = [];
  const repo: InactivityRepo = {
    dueForWarning: async (before, notOlderThan, limit) =>
      [...users.values()].filter((u) => u.lastSeen < before && u.lastSeen >= notOlderThan && u.warnedAt < u.lastSeen).slice(0, limit),
    markWarned: async (id, now) => void (users.get(id)!.warnedAt = now),
    dueForExpiry: async (before, limit) => [...users.values()].filter((u) => u.lastSeen < before).slice(0, limit),
    deleteUser: async (id) => void users.delete(id),
  };
  const telegram = { sendMessage: async (chatId: number, text: string) => (sent.push({ chatId, text }), respond(chatId)) };
  return { repo, telegram, users, sent };
};
const row = (id: string, daysAgo: number, over: Partial<Row> = {}): Row => ({ id, chatId: Number(id.slice(1)), lastSeen: NOW - daysAgo * DAY, warnedAt: 0, ...over });

describe('notifyInactive', () => {
  it('leaves recently active users alone', async () => {
    const s = setup([row('u1', 10), row('u2', 52)]);
    expect(await notifyInactive(s.repo, s.telegram, SITE, NOW)).toEqual({ warned: 0, expired: 0 });
    expect(s.sent).toEqual([]);
  });

  it('warns a user 7 days before the deadline, with the site link, and only once', async () => {
    const s = setup([row('u1', 54)]);
    expect(await notifyInactive(s.repo, s.telegram, SITE, NOW)).toEqual({ warned: 1, expired: 0 });
    expect(s.sent[0].text).toBe(TEXTS.inactivityWarning(SITE, 7));
    expect(s.sent[0].text).toContain(SITE);
    await notifyInactive(s.repo, s.telegram, SITE, NOW + 600);
    expect(s.sent).toHaveLength(1);
  });

  it('warns again after a new visit and a new stretch of inactivity', async () => {
    const s = setup([row('u1', 54, { warnedAt: NOW - 100 * DAY })]);
    // warned long before the last visit: the old warning no longer counts
    expect(await notifyInactive(s.repo, s.telegram, SITE, NOW)).toMatchObject({ warned: 1 });
  });

  it('removes a user past the deadline after telling them', async () => {
    const s = setup([row('u1', 61)]);
    expect(await notifyInactive(s.repo, s.telegram, SITE, NOW)).toEqual({ warned: 0, expired: 1 });
    expect(s.sent[0].text).toBe(TEXTS.inactivityExpired);
    expect(s.users.size).toBe(0);
  });

  it('removes the data even if the bot was blocked, but keeps it when the send merely failed', async () => {
    const blocked = setup([row('u1', 61)], () => ({ ok: false, reason: 'blocked' }));
    await notifyInactive(blocked.repo, blocked.telegram, SITE, NOW);
    expect(blocked.users.size).toBe(0);

    const failing = setup([row('u1', 61)], () => ({ ok: false, reason: 'error' }));
    expect(await notifyInactive(failing.repo, failing.telegram, SITE, NOW)).toEqual({ warned: 0, expired: 0 });
    expect(failing.users.size).toBe(1);
  });

  it('never tells someone past the deadline that they have 7 days left', async () => {
    const failing = setup([row('u1', 61)], () => ({ ok: false, reason: 'error' }));
    await notifyInactive(failing.repo, failing.telegram, SITE, NOW);
    expect(failing.sent.every((m) => m.text === TEXTS.inactivityExpired)).toBe(true);
  });

  it('does not mark a warning that was not delivered, and stops on a rate limit', async () => {
    const failing = setup([row('u1', 54), row('u2', 55)], () => ({ ok: false, reason: 'rate_limited', retryAfter: 5 }));
    expect(await notifyInactive(failing.repo, failing.telegram, SITE, NOW)).toEqual({ warned: 0, expired: 0 });
    expect(failing.sent).toHaveLength(1);
    expect(failing.users.get('u1')!.warnedAt).toBe(0);
  });
});
