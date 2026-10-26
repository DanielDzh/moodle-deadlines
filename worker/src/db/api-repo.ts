import type { ApiRepo, SyncTask } from '../types';

/** D1 chunk size: D1 limits the number of bound parameters per statement. */
const DELETE_CHUNK = 50;

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** D1 implementation of the site API's storage. */
export const createApiRepo = (db: D1Database): ApiRepo => ({
  deleteExpiredPending: async (now) => {
    await db.prepare("DELETE FROM users WHERE status = 'pending' AND link_expires < ?1").bind(now).run();
  },

  pendingCount: async () => {
    const row = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'pending'").first<{ n: number }>();
    return row?.n ?? 0;
  },

  createPending: async (u) => {
    await db
      .prepare(
        `INSERT INTO users (id, link_code, link_expires, sync_key_hash, site, token_enc, tz, status, created_at, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8)`,
      )
      .bind(u.id, u.code, u.expires, u.syncKeyHash, u.site, u.tokenEnc, u.tz, u.now)
      .run();
  },

  findBySyncKeyHash: async (hash) =>
    db
      .prepare(
        `SELECT id, status FROM users WHERE sync_key_hash = ?1
         ORDER BY (status = 'active') DESC, created_at DESC LIMIT 1`,
      )
      .bind(hash)
      .first<{ id: string; status: string }>(),

  replaceTasks: async (userId, tasks: readonly SyncTask[], now) => {
    const existing = await db.prepare('SELECT key FROM tasks WHERE user_id = ?1').bind(userId).all<{ key: string }>();
    const keep = new Set(tasks.map((t) => t.key));
    const stale = existing.results.map((r) => r.key).filter((k) => !keep.has(k));

    const statements = [
      ...tasks.map((t) =>
        db
          .prepare(
            `INSERT INTO tasks (user_id, key, name, course, url, due, done, submitted)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT (user_id, key) DO UPDATE SET
               name = excluded.name, course = excluded.course, url = excluded.url,
               due = excluded.due, done = excluded.done, submitted = excluded.submitted`,
          )
          .bind(userId, t.key, t.name, t.course, t.url, t.due, t.done ? 1 : 0, t.submitted ? 1 : 0),
      ),
      ...chunk(stale, DELETE_CHUNK).map((keys) =>
        db
          .prepare(`DELETE FROM tasks WHERE user_id = ?1 AND key IN (${keys.map((_, i) => `?${i + 2}`).join(',')})`)
          .bind(userId, ...keys),
      ),
      db.prepare('UPDATE users SET last_seen_at = ?1 WHERE id = ?2').bind(now, userId),
    ];
    await db.batch(statements);
    return tasks.length;
  },

  deleteUser: async (userId) => {
    await db.prepare('DELETE FROM users WHERE id = ?1').bind(userId).run();
  },
});
