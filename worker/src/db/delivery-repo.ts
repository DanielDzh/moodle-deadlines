import type { DeliveryRepo, UserBatch } from '../services/deliver-reminders';
import { sentKey } from '../lib/reminder-planner';
import type { PlannerTask, ReminderKind } from '../types';

interface Row {
  user_id: string;
  chat_id: number;
  tz: string;
  key: string;
  name: string;
  course: string;
  url: string;
  due: number;
  done: number;
  submitted: number;
  muted: number;
  snooze_until: number;
}

/** D1 implementation of the reminder delivery storage. */
export const createDeliveryRepo = (db: D1Database): DeliveryRepo => ({
  loadBatches: async (now, horizonSec) => {
    const until = now + horizonSec;
    const tasks = await db
      .prepare(
        `SELECT u.id AS user_id, u.chat_id, u.tz, t.key, t.name, t.course, t.url, t.due, t.done, t.submitted, t.muted, t.snooze_until
         FROM tasks t JOIN users u ON u.id = t.user_id
         WHERE u.status = 'active' AND u.chat_id IS NOT NULL
           AND t.due > ?1 AND t.due <= ?2 AND t.done = 0 AND t.submitted = 0 AND t.muted = 0`,
      )
      .bind(now, until)
      .all<Row>();
    if (!tasks.results.length) return [];

    const sentRows = await db
      .prepare('SELECT user_id, task_key, due, kind FROM sent_reminders WHERE due > ?1 AND due <= ?2')
      .bind(now, until)
      .all<{ user_id: string; task_key: string; due: number; kind: ReminderKind }>();
    const sentByUser = new Map<string, Set<string>>();
    for (const s of sentRows.results) {
      const set = sentByUser.get(s.user_id) ?? new Set<string>();
      set.add(sentKey(s.task_key, s.due, s.kind));
      sentByUser.set(s.user_id, set);
    }

    const batches = new Map<string, UserBatch>();
    for (const r of tasks.results) {
      const batch = batches.get(r.user_id) ?? { userId: r.user_id, chatId: r.chat_id, tz: r.tz, tasks: [], sent: sentByUser.get(r.user_id) ?? new Set<string>() };
      const task: PlannerTask = {
        key: r.key, name: r.name, course: r.course, url: r.url, due: r.due,
        done: !!r.done, submitted: !!r.submitted, muted: !!r.muted, snoozeUntil: r.snooze_until,
      };
      batch.tasks.push(task);
      batches.set(r.user_id, batch);
    }
    return [...batches.values()];
  },

  markSent: async (userId, reminder, now) => {
    await db
      .prepare('INSERT OR IGNORE INTO sent_reminders (user_id, task_key, due, kind, sent_at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(userId, reminder.task.key, reminder.task.due, reminder.kind, now)
      .run();
  },

  deleteUser: async (userId) => {
    await db.prepare('DELETE FROM users WHERE id = ?1').bind(userId).run();
  },
});
