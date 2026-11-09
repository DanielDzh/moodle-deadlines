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
  /** Random anonymous browser id for statistics. Not linked to any account. */
  visitorId: 'md.vid',
  /** "Do not count me": set on the privacy page. */
  noStats: 'md.noStats',
  /** The first-visit reminders hint was closed (or used) and must not come back. */
  remindersHintDismissed: 'md.hintReminders',
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

/** The privacy page (public/privacy.html), relative to the site root so it works in a subfolder too. */
export const PRIVACY_URL = `${import.meta.env.BASE_URL}privacy.html`;
export const PRIVACY_LABEL = 'Політика приватності';

/** Telegram reminders service (the Worker in worker/). */
/** Overridable with VITE_REMINDERS_API_URL for local development against `wrangler dev`. */
export const REMINDERS_API_URL: string =
  import.meta.env.VITE_REMINDERS_API_URL || 'https://moodle-deadlines-bot.tinyapp.workers.dev';

/** Anonymous usage statistics (the Worker counts days, hours and events; no IP, no accounts). */
export const ANALYTICS_URL = `${REMINDERS_API_URL}/api/hit`;
export type AnalyticsEvent = 'visit' | 'login' | 'reminders_open' | 'donate_click';

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

/** Task kind of events that come from a calendar export file: no module type and no submission status. */
export const CALENDAR_KIND = 'ical';

/** Value of `Snapshot.source` for data that comes from a calendar export file. */
export const CALENDAR_SOURCE = 'ical';

/** Reading a calendar export file (.ics). */
export const CALENDAR = {
  /** The file picker offers calendar files only. */
  accept: '.ics,text/calendar',
  /** Larger files are refused before they are read, bytes. */
  maxFileBytes: 2 * 1024 * 1024,
  /** A task description is cut to this many characters. */
  introMaxChars: 2000,
  /** The raw description is cut to this many characters before any cleaning, so a hostile file cannot make the cleaning slow. */
  maxDescriptionChars: 20_000,
  /** Longest activity link that is searched for in a description, characters. */
  maxLinkChars: 300,
  /** Moodle's calendar day page: the link for an event whose description has no link. The deadline time is appended. */
  dayViewPath: '/calendar/view.php?view=day&time=',
  /**
   * Moodle (Ukrainian) names a deadline event "Строк <name> спливає", i.e. "<name> is due".
   * These parts are removed from task names; on another language the full text is shown.
   */
  namePrefixes: ['Строк '],
  nameSuffixes: [' спливає'],
} as const;

/** Text of the calendar sign-in and of the board in calendar mode (UI text, Ukrainian). */
export const CALENDAR_TEXTS = {
  tabPassword: 'Логін і пароль',
  tabCalendar: 'Через календар',
  tabsLabel: 'Спосіб входу',
  intro: 'Без логіна й пароля: завантажте файл календаря, який експортує ваш Moodle.',
  steps: [
    'У Moodle відкрийте Календар → «Імпорт чи експорт календарів» → «Експортувати календар».',
    'Виберіть усі події й найширший період, який пропонує Moodle (власний діапазон на весь навчальний рік). Вузький період сховає частину дедлайнів.',
    'Натисніть кнопку експорту: браузер завантажить файл .ics. Виберіть його нижче.',
  ],
  pick: 'Вибрати файл .ics',
  drop: 'або перетягніть його сюди',
  reading: 'Читаю файл…',
  remember: 'Запам’ятати на цьому пристрої',
  privacy: 'Файл читається лише у вашому браузері й нікуди не надсилається. Паролі й токени не потрібні.',
  limits:
    'У календарі немає статусу «подано», тому позначайте виконане вручну. Нагадування в Telegram працюють лише при вході з логіном і паролем.',
  errors: {
    tooBig: 'Файл завеликий для календаря. Експортуйте вужчий період.',
    read: 'Не вдалося прочитати файл. Спробуйте ще раз.',
    notCalendar: 'Це не схоже на файл календаря (.ics). Експортуйте календар із Moodle і виберіть завантажений файл.',
    empty: 'У файлі не знайшлося подій із датою. Перевірте період і тип подій під час експорту.',
  },
  /** Used in place of a course when an event has no category. */
  noCourse: 'Без курсу',
  /** Prefix of the line under the brand name. */
  userLabel: 'Календар',
  replace: 'Завантажити новий файл',
  /** Summary label: without submission statuses "overdue" can only mean "not ticked as done". */
  overdue: 'прострочено, перевірте здачу',
  /** A permanent notice at the top of the board: the calendar cannot tell whether work was handed in. */
  notice: {
    title: 'Перевірте здачу в Moodle самі',
    text: 'Календар не знає, чи ви вже здали роботу, тому всі завдання тут виглядають невиконаними. Перевірте в Moodle, особливо прострочені й ті, що горять, а здане позначайте галочкою.',
    link: 'Відкрити Moodle',
  },
  logout: 'Збережені завдання буде видалено з цього браузера. Щоб знову їх побачити, доведеться завантажити файл календаря.',
  empty: 'Тут порожньо. Виберіть інший курс або вимкніть «Приховати виконані».',
  footer:
    'Дані взято з файлу календаря, завантаженого {date}. Щоб оновити, завантажте новий файл. Позначки «виконано» зберігаються лише в цьому браузері.',
} as const;

/** Label of the theme button for each theme (UI text, Ukrainian). */
export const THEME_LABEL = {
  auto: 'Тема: як у системі',
  light: 'Тема: світла',
  dark: 'Тема: темна',
} as const;

/** First-visit hint that points at the reminders button (UI text, Ukrainian). */
export const REMINDERS_HINT = {
  text: 'Нагадування в Telegram: бот напише за добу й за 3 години до дедлайну',
  dismiss: 'Закрити підказку',
} as const;

/** Text of the reminders dialog and its errors (UI text, Ukrainian). */
export const REMINDER_TEXTS = {
  button: 'Нагадування',
  buttonActive: 'Нагадування ✓',
  title: 'Нагадування в Telegram',
  intro: 'Бот у Telegram нагадає про дедлайни за добу й за 3 години, навіть коли ви не відкриваєте сайт.',
  consentShort: 'Для цього сервіс зберігає ваш доступ до Moodle і список завдань. Вимкнути й видалити все можна будь-коли.',
  moreInfo: 'Докладніше про дані',
  consentDetails:
    'Зберігаємо: токен доступу до Moodle (зашифрований), назви й терміни завдань, ваш Telegram і часовий пояс. Усе це видаляється, коли ви вимикаєте нагадування тут або командою /stop у боті.',
  consentCheck: 'Погоджуюсь',
  consentRequired: 'Щоб підключити нагадування, підтвердіть згоду.',
  connect: 'Підключити Telegram',
  connecting: 'Підключаю…',
  pendingTitle: 'Лишився один крок',
  pendingSteps: ['Натисніть «Відкрити Telegram».', 'У чаті з ботом натисніть Start.'],
  pendingHint: 'Посилання діє 10 хвилин. Сторінка сама побачить підтвердження.',
  openBot: 'Відкрити Telegram',
  waiting: 'Чекаємо на підтвердження…',
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
    rate_limited: 'Забагато спроб підключення. Спробуйте за годину.',
    network: 'Не вдалося зв’язатися з сервісом нагадувань. Спробуйте ще раз.',
    default: 'Щось пішло не так. Спробуйте ще раз.',
  },
} as const;
