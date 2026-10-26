import { PRE_QUIET_LEAD_SEC, QUIET_HOURS, REMINDER_OFFSETS } from '../config';
import type { PlannedReminder, PlannerInput, ReminderKind } from '../types';
import { isQuietAt, quietWindowAround } from './quiet-hours';

/** Key in the set of already sent reminders. The deadline is part of the key: a moved deadline gives new reminders. */
export const sentKey = (taskKey: string, due: number, kind: ReminderKind): string => `${taskKey}|${due}|${kind}`;

/**
 * When a reminder actually goes out. If its time fell into quiet hours:
 * - deadline after the end of the quiet window: wait for the window to end;
 * - deadline before the end of the window (the night before a morning deadline): send shortly before the window starts, so it is not missed.
 */
const sendTime = (due: number, offsetSec: number, tz: string): number => {
  const trigger = due - offsetSec;
  const window = quietWindowAround(trigger, tz, QUIET_HOURS);
  if (!window) return trigger;
  return due > window.end ? window.end : window.start - PRE_QUIET_LEAD_SEC;
};

/**
 * Which reminders to send now. A pure function: reads and writes nothing.
 * For one task the closest available reminder is used: if the task was discovered late
 * (for example, 2 h left), the 24 h reminder is not sent, only the 3 h one.
 */
export const planReminders = ({ tasks, sent, now, tz }: PlannerInput): PlannedReminder[] => {
  if (isQuietAt(now, tz, QUIET_HOURS)) return [];
  const planned: PlannedReminder[] = [];
  for (const task of tasks) {
    if (!task.due || task.due <= now || task.done || task.submitted || task.muted) continue;
    const times = REMINDER_OFFSETS.map((o) => ({ kind: o.kind, at: sendTime(task.due, o.seconds, tz) }));
    times.forEach((current, i) => {
      if (current.at > now) return;
      if (sent.has(sentKey(task.key, task.due, current.kind))) return;
      const closer = times[i + 1];
      if (closer && closer.at <= now) return;
      planned.push({ task, kind: current.kind });
    });
  }
  return planned;
};
