import type { BandId, LoadStage } from './types';

/**
 * Version of the saved data format. Bump it when you change the Snapshot format,
 * so that users' old cache is not reused.
 * 2 — current courses only.
 */
export const DATA_VERSION = 2;

/** Moodle address pre-filled on the login screen until the user enters another one. */
export const DEFAULT_SITE = 'https://online.ubts.org.ua';

/** How many days before the due date an unsubmitted task starts "burning". To test: ?burnDays=7 */
export const BURN_DAYS = 2;

/** Course colour palette. A colour is tied to the course's position, not taken from the data. */
export const COURSE_COLORS = [
  '#3B6FD8', '#C2410C', '#0F8A6A', '#9333EA', '#B45309', '#0E7490',
  '#BE185D', '#4D7C0F', '#6D28D9', '#A16207', '#2563EB', '#DC2626',
] as const;

/** Labels for activity types that are not assignments (UI text, Ukrainian). */
export const KIND_LABEL: Record<string, string> = {
  forum: 'Форум',
  quiz: 'Тест',
  workshop: 'Семінар',
  lesson: 'Лекція',
  choice: 'Опитування',
  data: 'База даних',
  h5pactivity: 'H5P',
  scorm: 'SCORM',
};

export const BAND_ORDER: BandId[] = ['overdue', 'week', 'month', 'semester', 'later', 'none'];

export const BAND_TITLE: Record<BandId, string> = {
  overdue: 'Прострочено',
  week: 'Цей тиждень',
  month: 'Найближчий місяць',
  semester: 'До кінця семестру',
  later: 'Пізніше',
  none: 'Без терміну',
};

/** localStorage / sessionStorage keys. Same as in the first version, so users keep their data. */
export const KEYS = {
  site: 'md.site',
  token: 'md.token',
  data: 'md.data',
  remember: 'md.remember',
  done: 'md.done',
  hideDone: 'md.hideDone',
  hideSubmitted: 'md.hideSubmitted',
  chipsOpen: 'md.chipsOpen',
  filter: 'md.filter',
  theme: 'md.theme',
  syncKey: 'md.syncKey',
} as const;

/**
 * Author support: one Monobank jar for all projects. An empty URL hides the button;
 * during development (npm run dev) without a URL it is shown with a placeholder.
 */
export const DONATE_URL = 'https://send.monobank.ua/jar/2hB9555qM4';
export const DONATE_HREF = DONATE_URL || (import.meta.env.DEV ? '#donate-preview' : '');
export const DONATE_LABEL = 'Підтримати проєкт';

/** How often to check whether a new minute has started, ms. */
export const MINUTE_TICK_MS = 15_000;

/** Below this many hours to the deadline the time left is shown with hours ("1 день 14 год"); beyond that, days only. */
export const PRECISE_LEFT_HOURS = 72;

/** Full-page loader: shown every time data refreshes, so stale labels never show. */
export const LOADER = {
  /** Minimum time the loader stays visible so the steps do not flicker, ms. */
  minShowMs: 400,
  /** How long the loader stays visible with all ticks before the board opens, ms. */
  doneHoldMs: 180,
  /** Loader fade-out duration, ms. Must match the transition in .loading (styles.css). */
  fadeMs: 220,
} as const;

/** Loader steps in execution order (labels are UI text, Ukrainian). */
export const LOAD_STEPS: { id: Exclude<LoadStage, 'done'>; label: string }[] = [
  { id: 'courses', label: 'Курси' },
  { id: 'tasks', label: 'Завдання і терміни' },
  { id: 'statuses', label: 'Статуси здачі' },
];

/** Telegram reminders service (the Worker in worker/). */
/** Overridable with VITE_REMINDERS_API_URL for local development against `wrangler dev`. */
export const REMINDERS_API_URL: string =
  import.meta.env.VITE_REMINDERS_API_URL || 'https://moodle-deadlines-bot.tinyapp.workers.dev';

export const REMINDERS = {
  /** How often to ask whether the student pressed Start in the bot, ms. */
  pollMs: 3000,
  /** Wait this long after the last change before pushing tasks, ms. */
  syncDebounceMs: 1500,
  /** Network timeout for one request, ms. */
  requestTimeoutMs: 15000,
  /** Random bytes in the browser's sync key. */
  keyBytes: 32,
} as const;

/** Text of the reminders dialog and its errors (UI text, Ukrainian). */
export const REMINDER_TEXTS = {
  button: 'Нагадування',
  buttonActive: 'Нагадування ✓',
  title: 'Нагадування в Telegram',
  intro: 'Бот у Telegram нагадає про дедлайни за добу й за 3 години, навіть коли ви не відкриваєте сайт.',
  consentShort: 'Для цього сервіс зберігає ваш доступ до Moodle і список завдань. Вимкнути й видалити все можна будь-коли.',
  moreInfo: 'Докладніше про дані',
  consentTitle: 'Що зберігається на сервері',
  consentItems: [
    'ваш токен доступу до Moodle (у зашифрованому вигляді): через нього сервер сам дивиться нові завдання;',
    'назви, курси й терміни ваших завдань;',
    'ваш Telegram-чат і часовий пояс.',
  ],
  consentWarning:
    'Токен дає доступ до вашого акаунта в Moodle, тому підключайте нагадування, лише якщо довіряєте цьому сервісу. Вимкнути нагадування й видалити всі дані можна будь-коли: тут або командою /stop у боті.',
  consentCheck: 'Погоджуюсь',
  consentRequired: 'Щоб підключити нагадування, підтвердіть згоду.',
  connect: 'Підключити Telegram',
  connecting: 'Підключаю…',
  pendingTitle: 'Лишилось натиснути Start у боті',
  pendingText: 'Відкрийте бота за кнопкою нижче й натисніть Start. Сторінка сама дізнається, коли ви підтвердите. Посилання діє 10 хвилин.',
  openBot: 'Відкрити Telegram',
  waiting: 'Чекаю на підтвердження…',
  cancel: 'Скасувати',
  close: 'Закрити',
  activeTitle: 'Нагадування увімкнено',
  activeText: 'Бот напише за добу й за 3 години до кожного неподаного завдання. Нові завдання він підхоплює сам.',
  disable: 'Вимкнути й видалити дані',
  disabling: 'Вимикаю…',
  pausedTitle: 'Потрібно підключити знову',
  pausedText: 'Доступ до Moodle застарів, і нагадування призупинено. Підключіть Telegram ще раз.',
  logoutNote: 'Нагадування в Telegram теж вимкнеться, а дані на сервері буде видалено. Якщо ви без інтернету, вимкніть їх командою /stop у боті.',
  errors: {
    https_required: 'Для нагадувань потрібен Moodle за адресою https.',
    invalid_site: 'Цю адресу Moodle не можна підключити до нагадувань.',
    blocked_site: 'Цей Moodle не підтримується нагадуваннями.',
    invalid_token: 'Токен Moodle має неочікуваний вигляд. Увійдіть на сайті ще раз.',
    busy: 'Сервіс зараз зайнятий. Спробуйте за хвилину.',
    network: 'Не вдалося зв’язатися з сервісом нагадувань. Спробуйте ще раз.',
    default: 'Щось пішло не так. Спробуйте ще раз.',
  },
} as const;
