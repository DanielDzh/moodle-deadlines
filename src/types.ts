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
  onLoggedIn: (session: LoginSession) => void;
}
