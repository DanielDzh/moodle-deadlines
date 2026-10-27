/** Worker variables and bindings. Secrets are set via `wrangler secret put`. */
export interface Env {
  DB: D1Database;
  /** 32 random bytes in base64. The key that encrypts Moodle tokens. */
  TOKEN_KEY: string;
  /** Telegram bot token. */
  TELEGRAM_BOT_TOKEN: string;
  /** The secret Telegram sends in the webhook header. */
  TELEGRAM_WEBHOOK_SECRET: string;
  /** Comma-separated origins allowed to call the site API (the site's address). */
  ALLOWED_ORIGINS: string;
  /** The bot's username without @, used to build the t.me link. */
  BOT_USERNAME: string;
  /** Optional comma-separated Moodle hosts that are refused. */
  BLOCKED_SITES?: string;
  /** "1" skips the Moodle address check so a local mock Moodle works. Set only in .dev.vars, never in production. */
  DEV_ALLOW_ANY_SITE?: string;
  /** Secret for the owner's statistics page. */
  STATS_KEY?: string;
  /** The site's address, used in bot messages. */
  SITE_URL: string;
  /** Overrides https://api.telegram.org, so local runs can talk to a stand-in server. */
  TELEGRAM_API_BASE?: string;
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
  /** "Remind me later": no reminders before this Unix time; 0 — not snoozed. */
  snoozeUntil: number;
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

export type SiteCheck =
  | { ok: true; site: string }
  | { ok: false; reason: 'invalid_site' | 'https_required' | 'blocked_site' };

/** What the site sends to start linking. */
export interface LinkStartInput {
  site: string;
  token: string;
  tz: string;
  syncKey: string;
}

/** A task as the site reports it. */
export interface SyncTask {
  key: string;
  name: string;
  course: string;
  url: string;
  due: number;
  done: boolean;
  submitted: boolean;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Link state as the site sees it. */
export type LinkState = 'none' | 'pending' | 'active' | 'paused';

export interface NewPendingUser {
  id: string;
  code: string;
  expires: number;
  syncKeyHash: string;
  site: string;
  tokenEnc: string;
  tz: string;
  now: number;
}

/** What the site API needs from storage. D1 in production, memory in tests. */
export interface ApiRepo {
  deleteExpiredPending: (now: number) => Promise<void>;
  pendingCount: () => Promise<number>;
  createPending: (user: NewPendingUser) => Promise<void>;
  findBySyncKeyHash: (hash: string) => Promise<{ id: string; status: string } | null>;
  /** Makes the user's tracked tasks equal to the given list (keeps the snooze setting). Returns the count. */
  replaceTasks: (userId: string, tasks: readonly SyncTask[], now: number) => Promise<number>;
  /** Removes every user (and their tasks and sent reminders) that belongs to this browser key. */
  /** Keys of the user's tasks that are done (ticked on the site or pressed "Already done" in the bot). */
  doneKeys: (userId: string) => Promise<string[]>;
  deleteUsersBySyncKey: (hash: string) => Promise<void>;
  /** Removes only the unfinished link attempts of this browser key. */
  deletePendingBySyncKey: (hash: string) => Promise<void>;
}

/** Events the server counts itself. */
export type ServerEvent = 'reminders_linked' | 'reminders_unlinked' | 'reminder_sent';

/** Records a server-side event. Never throws: statistics must not break the feature they measure. */
export type Tracker = (event: ServerEvent, n?: number) => Promise<void>;

/** Where anonymous statistics are written. */
export interface AnalyticsRepo {
  record: (event: string, visitor: string, n: number, day: string, hour: number) => Promise<void>;
}

/** The read side used by the owner's statistics page. */
export interface StatsRepo {
  uniqueVisitorsSince: (day: string) => Promise<number>;
  perDay: (since: string) => Promise<{ day: string; visitors: number; visits: number; logins: number }[]>;
  visitsByHour: (since: string) => Promise<{ hour: number; visits: number }[]>;
  eventTotals: (since: string) => Promise<{ event: string; total: number; people: number }[]>;
  newAndReturning: (since: string) => Promise<{ newVisitors: number; returning: number }>;
  activeDaysHistogram: (since: string) => Promise<{ days: number; visitors: number }[]>;
}
