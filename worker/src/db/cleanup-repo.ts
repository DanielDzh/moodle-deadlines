import { INACTIVE_USER_DAYS, TASK_RETENTION_DAYS } from '../config';

const DAY = 86_400;

export interface CleanupReport {
  expiredLinks: number;
  inactiveUsers: number;
  oldTasks: number;
  oldReminders: number;
}

/**
 * Removes what is no longer needed: expired unfinished link attempts (they hold an encrypted token),
 * users who have not visited the site for a long time, tasks long past their deadline, their sent marks.
 */
export const cleanup = async (db: D1Database, now: number): Promise<CleanupReport> => {
  const changes = (r: D1Result) => r.meta.changes ?? 0;
  const [links, inactive, tasks, sent] = await db.batch([
    db.prepare("DELETE FROM users WHERE status = 'pending' AND link_expires < ?1").bind(now),
    db.prepare('DELETE FROM users WHERE last_seen_at < ?1').bind(now - INACTIVE_USER_DAYS * DAY),
    db.prepare('DELETE FROM tasks WHERE due < ?1').bind(now - TASK_RETENTION_DAYS * DAY),
    db.prepare('DELETE FROM sent_reminders WHERE due < ?1').bind(now - TASK_RETENTION_DAYS * DAY),
  ]);
  return { expiredLinks: changes(links), inactiveUsers: changes(inactive), oldTasks: changes(tasks), oldReminders: changes(sent) };
};
