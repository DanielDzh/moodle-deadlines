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
  maxKeyLength: 100,
  /** Unfinished link attempts allowed at once; protects the database from being filled with junk. */
  maxPendingUsers: 1000,
} as const;

/** How long a one-time link code stays valid, seconds. */
export const LINK_CODE_TTL_SEC = 10 * 60;

/** Shapes of values the site sends. */
export const PATTERNS = {
  /** The browser's random sync key (a bearer secret for the site API). */
  syncKey: /^[A-Za-z0-9_-]{32,128}$/,
  /** A Moodle web-service token (hex, sometimes longer or with a separator). */
  moodleToken: /^[A-Za-z0-9._-]{16,128}$/,
  taskKey: /^[A-Za-z0-9._:-]{1,100}$/,
} as const;

/** Latest sensible deadline (year 2100), seconds. */
export const MAX_DUE = 4_102_444_800;

/** Reminder delivery. */
export const DELIVERY = {
  /** Only tasks due within this many seconds are considered each minute (24 h plus room for night shifting). */
  horizonSec: 36 * 3600,
  /** At most this many reminders per user per cron tick; the rest go out on the next ticks. */
  maxPerUserPerTick: 5,
  /** "Remind me later" in the bot, seconds. */
  snoozeSec: 3600,
  /** Telegram allows 64 bytes in callback data. */
  maxCallbackBytes: 64,
  requestTimeoutMs: 10_000,
} as const;

export const TELEGRAM_API_BASE = 'https://api.telegram.org';

/** Encrypted token: the format version is a prefix so the algorithm can be changed later. */
export const TOKEN_FORMAT_VERSION = 'v1';
