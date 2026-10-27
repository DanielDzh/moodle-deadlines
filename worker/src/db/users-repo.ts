import type { BotRepo } from '../bot/types';

/** D1 implementation of the bot's storage. */
export const createUsersRepo = (db: D1Database): BotRepo => ({
  bindChat: async (code, chatId, now) => {
    const pending = await db
      .prepare("SELECT id, sync_key_hash FROM users WHERE link_code = ?1 AND link_expires > ?2 AND status = 'pending'")
      .bind(code, now)
      .first<{ id: string; sync_key_hash: string }>();
    if (!pending) return false;
    // One chat has one subscription and one browser has one subscription: older ones are replaced.
    // Order matters (UNIQUE chat_id): delete first, then update.
    await db.batch([
      db.prepare('DELETE FROM users WHERE chat_id = ?1').bind(chatId),
      db.prepare('DELETE FROM users WHERE sync_key_hash = ?1 AND id != ?2').bind(pending.sync_key_hash, pending.id),
      db
        .prepare(
          "UPDATE users SET chat_id = ?1, status = 'active', link_code = NULL, link_expires = NULL WHERE id = ?2",
        )
        .bind(chatId, pending.id),
    ]);
    return true;
  },

  deleteByChat: async (chatId) => {
    const result = await db.prepare('DELETE FROM users WHERE chat_id = ?1').bind(chatId).run();
    return (result.meta.changes ?? 0) > 0;
  },

  muteTask: async (chatId, taskKey) => {
    const result = await db
      .prepare('UPDATE tasks SET muted = 1 WHERE key = ?2 AND user_id = (SELECT id FROM users WHERE chat_id = ?1)')
      .bind(chatId, taskKey)
      .run();
    return (result.meta.changes ?? 0) > 0;
  },

  snoozeTask: async (chatId, taskKey, until) => {
    const [update] = await db.batch([
      db
        .prepare('UPDATE tasks SET snooze_until = ?3 WHERE key = ?2 AND user_id = (SELECT id FROM users WHERE chat_id = ?1)')
        .bind(chatId, taskKey, until),
      // Forget the reminder that was just sent, so it goes out again once the snooze is over.
      db
        .prepare(
          `DELETE FROM sent_reminders WHERE rowid = (
             SELECT rowid FROM sent_reminders
             WHERE task_key = ?2 AND user_id = (SELECT id FROM users WHERE chat_id = ?1)
             ORDER BY sent_at DESC LIMIT 1)`,
        )
        .bind(chatId, taskKey),
    ]);
    return (update.meta.changes ?? 0) > 0;
  },

  trackedTasks: async (chatId, now) => {
    const row = await db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM tasks t
                 WHERE t.user_id = u.id AND t.due > ?2 AND t.done = 0 AND t.submitted = 0 AND t.muted = 0) AS n
         FROM users u WHERE u.chat_id = ?1`,
      )
      .bind(chatId, now)
      .first<{ n: number }>();
    return row ? row.n : null;
  },
});
