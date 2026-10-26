/** Worker variables and bindings. Secrets are set via `wrangler secret put`. */
export interface Env {
  DB: D1Database;
  /** 32 random bytes in base64. The key that encrypts Moodle tokens. */
  TOKEN_KEY: string;
  /** Telegram bot token. */
  TELEGRAM_BOT_TOKEN: string;
  /** The secret Telegram sends in the webhook header. */
  TELEGRAM_WEBHOOK_SECRET: string;
}

export type ReminderKind = '24h' | '3h';

export interface ReminderOffset {
  kind: ReminderKind;
  seconds: number;
}

export interface QuietHours {
  startHour: number;
  endHour: number;
}

/** A user's task as the reminder planner sees it. */
export interface PlannerTask {
  key: string;
  name: string;
  course: string;
  url: string;
  /** Deadline, Unix time in seconds; 0 — no deadline. */
  due: number;
  done: boolean;
  submitted: boolean;
  /** The user turned reminders off for this task with the "Already done" button. */
  muted: boolean;
}

export interface PlannerInput {
  tasks: readonly PlannerTask[];
  /** Keys of reminders already sent (see sentKey). */
  sent: ReadonlySet<string>;
  /** Current time, seconds. */
  now: number;
  /** The student's time zone (IANA), for example Europe/Kyiv. */
  tz: string;
}

export interface PlannedReminder {
  task: PlannerTask;
  kind: ReminderKind;
}

export interface TimeWindow {
  start: number;
  end: number;
}
