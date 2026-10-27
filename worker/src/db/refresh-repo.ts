import { LIMITS, MOODLE } from '../config';
import type { Collected } from '../moodle/collect-tasks';
import type { RefreshRepo } from '../services/refresh-user';

const DELETE_CHUNK = 50;

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** D1 implementation of the server-side refresh storage. */
export const createRefreshRepo = (db: D1Database): RefreshRepo => ({
  nextTarget: async (now) => {
    // A failed fetch doubles the wait (up to 16x), so a broken account does not hit Moodle every few hours.
    const row = await db
      .prepare(
        `SELECT id, site, token_enc, chat_id FROM users
         WHERE status = 'active' AND token_enc IS NOT NULL
           AND last_fetch_at + ?1 * (1 << MIN(fetch_failures, ?2)) <= ?3
         ORDER BY last_fetch_at ASC LIMIT 1`,
      )
      .bind(MOODLE.refreshIntervalSec, MOODLE.maxFailureBackoffPower, now)
      .first<{ id: string; site: string; token_enc: string; chat_id: number | null }>();
    return row ? { id: row.id, site: row.site, tokenEnc: row.token_enc, chatId: row.chat_id } : null;
  },

  saveTasks: async (userId, { tasks, complete }: Collected, now) => {
    const existing = complete
      ? await db.prepare('SELECT key FROM tasks WHERE user_id = ?1 AND due > ?2').bind(userId, now).all<{ key: string }>()
      : { results: [] as { key: string }[] };
    const keep = new Set(tasks.map((t) => t.key));
    const stale = existing.results.map((r) => r.key).filter((k) => !keep.has(k));

    await db.batch([
      // done, muted and snooze_until belong to the user and are never touched here;
      // submitted keeps its old value when Moodle was not asked (null).
      ...tasks.slice(0, LIMITS.maxTasks).map((t) =>
        db
          .prepare(
            `INSERT INTO tasks (user_id, key, name, course, url, due, submitted)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, 0))
             ON CONFLICT (user_id, key) DO UPDATE SET
               name = excluded.name, course = excluded.course, url = excluded.url, due = excluded.due,
               submitted = CASE WHEN ?7 IS NULL THEN tasks.submitted ELSE ?7 END`,
          )
          .bind(userId, t.key, t.name, t.course, t.url, t.due, t.submitted === null ? null : t.submitted ? 1 : 0),
      ),
      ...chunk(stale, DELETE_CHUNK).map((keys) =>
        db
          .prepare(`DELETE FROM tasks WHERE user_id = ?1 AND key IN (${keys.map((_, i) => `?${i + 2}`).join(',')})`)
          .bind(userId, ...keys),
      ),
      db.prepare('UPDATE users SET last_fetch_at = ?1, fetch_failures = 0 WHERE id = ?2').bind(now, userId),
    ]);
  },

  markFailed: async (userId, now) => {
    await db.prepare('UPDATE users SET last_fetch_at = ?1, fetch_failures = fetch_failures + 1 WHERE id = ?2').bind(now, userId).run();
  },

  pause: async (userId) => {
    await db.prepare("UPDATE users SET status = 'paused_auth', token_enc = NULL WHERE id = ?1").bind(userId).run();
  },
});
