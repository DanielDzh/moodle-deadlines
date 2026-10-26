import type { BotRepo } from '../bot/types';

/** D1 implementation of the bot's storage. */
export const createUsersRepo = (db: D1Database): BotRepo => ({
  bindChat: async (code, chatId, now) => {
    const pending = await db
      .prepare("SELECT id FROM users WHERE link_code = ?1 AND link_expires > ?2 AND status = 'pending'")
      .bind(code, now)
      .first<{ id: string }>();
    if (!pending) return false;
    // One chat has one subscription: an older one for the same chat is replaced. Order matters (UNIQUE chat_id).
    await db.batch([
      db.prepare('DELETE FROM users WHERE chat_id = ?1').bind(chatId),
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
