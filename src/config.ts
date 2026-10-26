import type { BandId, LoadStage } from './types';

/**
 * Версія формату збережених даних. Збільште її, якщо змінюєте формат Snapshot,
 * щоб у користувачів старий кеш не використовувався.
 * 2 — лише поточні курси.
 */
export const DATA_VERSION = 2;

/** Moodle, який підставляється у вхід, поки людина не вказала інший. */
export const DEFAULT_SITE = 'https://online.ubts.org.ua';

/** За скільки днів до терміну неподане завдання починає «горіти». Для перевірки: ?burnDays=7 */
export const BURN_DAYS = 2;

/** Палітра курсів. Колір прив'язаний до порядку курсу, а не береться з даних. */
export const COURSE_COLORS = [
  '#3B6FD8', '#C2410C', '#0F8A6A', '#9333EA', '#B45309', '#0E7490',
  '#BE185D', '#4D7C0F', '#6D28D9', '#A16207', '#2563EB', '#DC2626',
] as const;

/** Підписи для типів активностей, які не є завданнями. */
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

/** Ключі в localStorage / sessionStorage. Ті самі, що в першій версії, тож дані користувачів зберігаються. */
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
} as const;

/**
 * Підтримка автора: одна банка Monobank на всі проєкти. Порожня адреса ховає кнопку;
 * під час розробки (npm run dev) без адреси вона показується із заглушкою.
 */
export const DONATE_URL = 'https://send.monobank.ua/jar/2hB9555qM4';
export const DONATE_HREF = DONATE_URL || (import.meta.env.DEV ? '#donate-preview' : '');
export const DONATE_LABEL = 'Підтримати проєкт';

/** Як часто перевіряти, чи почалася нова хвилина, мс. */
export const MINUTE_TICK_MS = 15_000;

/** Якщо до терміну менше стільки годин, залишок показується з годинами («1 день 14 год»); далі — лише дні. */
export const PRECISE_LEFT_HOURS = 72;

/** Повноекранний лоадер: показується щоразу, коли дані оновлюються, щоб не світилися застарілі лейбли. */
export const LOADER = {  /** Мінімальний час показу лоадера, щоб кроки не мигали, мс. */
  minShowMs: 400,
  /** Скільки лоадер лишається з усіма галочками перед тим, як відкрити дошку, мс. */
  doneHoldMs: 180,
  /** Тривалість плавного зникнення лоадера, мс. Має збігатися з transition у .loading (styles.css). */
  fadeMs: 220,
} as const;

/** Кроки лоадера в порядку виконання. */
export const LOAD_STEPS: { id: Exclude<LoadStage, 'done'>; label: string }[] = [
  { id: 'courses', label: 'Курси' },
  { id: 'tasks', label: 'Завдання і терміни' },
  { id: 'statuses', label: 'Статуси здачі' },
];
