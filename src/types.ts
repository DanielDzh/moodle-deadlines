/** Курс, у якому навчається користувач. Дати — Unix-час у секундах (як у Moodle). */
export interface Course {
  id: number;
  name: string;
  short: string;
  start: number;
  end: number;
  color: string;
}

/** Статус подання завдання: значення з Moodle плюс 'unknown', якщо статус не вдалося отримати. */
export type SubmissionStatus = '' | 'new' | 'draft' | 'submitted' | 'graded' | 'reopened' | 'unknown' | (string & {});

/** Одне завдання, форум, тест чи інша активність із терміном. */
export interface Task {
  /** Стабільний ключ, за яким зберігається галочка «Виконано». */
  key: string;
  /** Тип модуля Moodle: assign, forum, quiz… */
  kind: string;
  courseid: number;
  cmid: number | null;
  assignid?: number;
  name: string;
  /** Термін здачі; 0 — без терміну. */
  due: number;
  /** Коли відкривається приймання робіт; 0 — одразу. */
  open: number;
  /** Остаточний термін, після якого Moodle не приймає роботи; 0 — немає. */
  cutoff: number;
  intro: string;
  url: string;
  status: SubmissionStatus;
  grade?: string;
}

/** Зліпок даних, який зберігається в браузері між відкриттями сторінки. */
export interface Snapshot {
  v: number;
  collectedAt: number;
  base: string;
  user: string;
  courses: Course[];
  items: Task[];
}

/** Етап завантаження даних з Moodle. 'done' — усе завантажено. */
export type LoadStage = 'courses' | 'tasks' | 'statuses' | 'done';

/** Прогрес завантаження: поточний етап і, для статусів подань, лічильник. */
export interface LoadProgress {
  stage: LoadStage;
  done?: number;
  total?: number;
}

export type BandId = 'overdue' | 'week' | 'month' | 'semester' | 'later' | 'none';
export type Urgency = 'u-over' | 'u-hot' | 'u-warm' | 'u-mild' | 'u-calm' | 'u-none';

/** Завдання з полями, обчисленими відносно сьогоднішньої дати. */
export interface DecoratedTask extends Task {
  band: BandId;
  /** Скільки календарних днів до терміну (від'ємне — минуло); null — без терміну. */
  days: number | null;
  overdue: boolean;
  urg: Urgency;
}

export type Theme = 'auto' | 'light' | 'dark';

/** Що повертає успішний вхід. */
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
