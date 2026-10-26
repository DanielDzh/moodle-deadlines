import type { BandId } from './types';

/**
 * Версія формату збережених даних. Збільште її, якщо змінюєте формат Snapshot,
 * щоб у користувачів старий кеш не використовувався.
 * 2 — лише поточні курси.
 */
export const DATA_VERSION = 2;

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
