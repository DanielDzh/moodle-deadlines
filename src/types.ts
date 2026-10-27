/** A course the user is enrolled in. Dates are Unix time in seconds (as in Moodle). */
export interface Course {
  id: number;
  name: string;
  short: string;
  start: number;
  end: number;
  color: string;
}

/** Submission status of an assignment: Moodle's value plus 'unknown' when the status could not be fetched. */
export type SubmissionStatus = '' | 'new' | 'draft' | 'submitted' | 'graded' | 'reopened' | 'unknown' | (string & {});

/** One assignment, forum, quiz or other activity with a deadline. */
export interface Task {
  /** Stable key under which the "Done" tick is stored. */
  key: string;
  /** Moodle module type: assign, forum, quiz… */
  kind: string;
  courseid: number;
  cmid: number | null;
  assignid?: number;
  name: string;
  /** Due date; 0 — no deadline. */
  due: number;
  /** When submissions open; 0 — immediately. */
  open: number;
  /** Final deadline after which Moodle stops accepting work; 0 — none. */
  cutoff: number;
  intro: string;
  url: string;
  status: SubmissionStatus;
  grade?: string;
}

/** Data snapshot stored in the browser between page visits. */
export interface Snapshot {
  v: number;
  collectedAt: number;
  base: string;
  user: string;
  courses: Course[];
  items: Task[];
}

/** Stage of loading data from Moodle. 'done' — everything loaded. */
export type LoadStage = 'courses' | 'tasks' | 'statuses' | 'done';

/** Loading progress: current stage and, for submission statuses, a counter. */
export interface LoadProgress {
  stage: LoadStage;
  done?: number;
  total?: number;
}

export type BandId = 'overdue' | 'week' | 'month' | 'semester' | 'later' | 'none';
export type Urgency = 'u-over' | 'u-hot' | 'u-warm' | 'u-mild' | 'u-calm' | 'u-none';

/** A task with fields computed relative to today's date. */
export interface DecoratedTask extends Task {
  band: BandId;
  /** Calendar days until the deadline (negative — already passed); null — no deadline. */
  days: number | null;
  overdue: boolean;
  urg: Urgency;
}

export type Theme = 'auto' | 'light' | 'dark';

/** What a successful login returns. */
export interface LoginSession {
  site: string;
  token: string;
  remember: boolean;
}

export interface LoginScreenProps {
  site: string;
  remember: boolean;
  message?: string;
  theme: Theme;
  onNextTheme: () => void;
  onLoggedIn: (session: LoginSession) => void;
}

/** Link state of the Telegram reminders as the site sees it. */
export type ReminderState = 'unknown' | 'none' | 'pending' | 'active' | 'paused' | 'unavailable';

/** What the reminders service reports about this browser's link. */
export interface LinkStatus {
  state: ReminderState;
  /** Keys of tasks that are done on the server (including the bot's "Already done" presses). */
  done: string[];
}

/** One task as it is pushed to the reminders service. */
export interface ReminderItem {
  key: string;
  name: string;
  course: string;
  url: string;
  due: number;
  done: boolean;
  submitted: boolean;
}

/** Everything the UI needs from the reminders feature. */
export interface RemindersApi {
  state: ReminderState;
  /** Task keys marked done in the bot; the board merges them into its own ticks. */
  remoteDone: readonly string[];
  /** t.me link with the one-time code while a link is pending. */
  botUrl: string;
  /** User-facing error text, empty when there is none. */
  error: string;
  busy: boolean;
  start: () => Promise<void>;
  /** Stops a pending link or turns reminders off and deletes the server-side data. True on success. */
  disable: () => Promise<boolean>;
  /** Pushes the current tasks to the service shortly (debounced); does nothing unless reminders are active. */
  syncSoon: (snapshot: Snapshot, done: Record<string, boolean>) => void;
  clearError: () => void;
}
