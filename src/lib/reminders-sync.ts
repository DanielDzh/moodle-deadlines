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

/** The same set of keys, in any order. */
export const sameKeys = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((key) => b.includes(key));

/**
 * Adds the tasks that were marked done on the server (the bot's "Already done") to the site's own ticks.
 * Ticks are only added here; unticking on the site reaches the server through the next sync, which comes before the next pull.
 * Returns the same object when nothing changes, so React does not re-render for nothing.
 */
export const mergeRemoteDone = (done: Record<string, boolean>, remote: readonly string[]): Record<string, boolean> => {
  const missing = remote.filter((key) => !done[key]);
  return missing.length ? { ...done, ...Object.fromEntries(missing.map((key) => [key, true])) } : done;
};
