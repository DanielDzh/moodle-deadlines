import { isSubmitted } from './board';
import type { ReminderItem, Snapshot } from '../types';

/**
 * Tasks to push to the reminders service: only those with a deadline still ahead.
 * Overdue and undated tasks are never reminded about, so they are not sent.
 */
export const buildReminderItems = (snapshot: Snapshot, done: Record<string, boolean>, nowSec: number): ReminderItem[] => {
  const courses = new Map(snapshot.courses.map((c) => [c.id, c.name]));
  return snapshot.items
    .filter((t) => t.due > nowSec)
    .map((t) => ({
      key: t.key,
      name: t.name,
      course: courses.get(t.courseid) ?? '',
      url: t.url,
      due: t.due,
      done: !!done[t.key],
      submitted: isSubmitted(t),
    }));
};
