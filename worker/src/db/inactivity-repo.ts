import type { InactivityRepo } from '../services/notify-inactive';

/** D1 implementation of the inactivity notifications' storage. */
export const createInactivityRepo = (db: D1Database): InactivityRepo => ({
  dueForWarning: async (before, notOlderThan, limit) => {
    const rows = await db
      .prepare(
        `SELECT id, chat_id FROM users
         WHERE status = 'active' AND chat_id IS NOT NULL
           AND last_seen_at < ?1 AND last_seen_at >= ?2 AND inactivity_warned_at < last_seen_at
         ORDER BY last_seen_at ASC LIMIT ?3`,
      )
      .bind(before, notOlderThan, limit)
      .all<{ id: string; chat_id: number }>();
    return rows.results.map((r) => ({ id: r.id, chatId: r.chat_id }));
  },

  markWarned: async (userId, now) => {
    await db.prepare('UPDATE users SET inactivity_warned_at = ?1 WHERE id = ?2').bind(now, userId).run();
  },

  dueForExpiry: async (before, limit) => {
    const rows = await db
      .prepare("SELECT id, chat_id FROM users WHERE status = 'active' AND chat_id IS NOT NULL AND last_seen_at < ?1 ORDER BY last_seen_at ASC LIMIT ?2")
      .bind(before, limit)
      .all<{ id: string; chat_id: number }>();
    return rows.results.map((r) => ({ id: r.id, chatId: r.chat_id }));
  },

  deleteUser: async (userId) => {
    await db.prepare('DELETE FROM users WHERE id = ?1').bind(userId).run();
  },
});
