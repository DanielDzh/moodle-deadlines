import type { QuietHours, ReminderOffset } from './types';

/** When to remind: seconds before the deadline. From larger to smaller. */
export const REMINDER_OFFSETS: readonly ReminderOffset[] = [
  { kind: '24h', seconds: 24 * 3600 },
  { kind: '3h', seconds: 3 * 3600 },
];

/** Quiet hours in the student's local time: no reminders are sent then. */
export const QUIET_HOURS: QuietHours = { startHour: 23, endHour: 8 };

/** A reminder that fell into quiet hours just before a deadline is sent this many seconds before they start. */
export const PRE_QUIET_LEAD_SEC = 5 * 60;

/** How many days a task is kept after its deadline. */
export const TASK_RETENTION_DAYS = 7;

/** After this many days without a visit to the site a subscription is considered abandoned and is deleted. */
export const INACTIVE_USER_DAYS = 60;

/** Limits on the data the site sends. */
export const LIMITS = {
  maxTasks: 300,
  maxNameLength: 200,
  maxCourseLength: 120,
  maxUrlLength: 500,
} as const;

/** Encrypted token: the format version is a prefix so the algorithm can be changed later. */
export const TOKEN_FORMAT_VERSION = 'v1';
