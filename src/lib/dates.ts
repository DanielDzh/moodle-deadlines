import { PRECISE_LEFT_HOURS } from '../config';

/** Українські відмінки після числа: 1 день, 2 дні, 5 днів, 11 днів, 21 день… */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  const m10 = a % 10;
  const m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const dayWord = (n: number) => plural(n, 'день', 'дні', 'днів');
export const taskWord = (n: number) => plural(n, 'завдання', 'завдання', 'завдань');

const toDate = (ts: number) => new Date(ts * 1000);

/** «пт, 31 жовтня» (рік — лише якщо не поточний). */
export function fmtDay(ts: number, now = new Date()): string {
  const d = toDate(ts);
  const o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString('uk-UA', o);
}

/** «31 жовтня» (рік — лише якщо не поточний). */
export function fmtDayLong(ts: number, now = new Date()): string {
  const d = toDate(ts);
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString('uk-UA', o);
}

export const fmtTime = (ts: number) => toDate(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (ts: number, now = new Date()) => `${fmtDayLong(ts, now)} о ${fmtTime(ts)}`;

/** Різниця в календарних днях між датою терміну і сьогодні (за місцевим часом). */
export function daysUntil(ts: number, now = new Date()): number {
  const d = toDate(ts);
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 864e5);
}

/** Ключ календарного дня для групування завдань з однією датою. */
export function dayKey(ts: number): string {
  const d = toDate(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function whenPhrase(days: number): string {
  if (days === 0) return 'сьогодні';
  if (days === 1) return 'завтра';
  return `через ${days} ${dayWord(days)}`;
}

/** Залишок до терміну в годинах і хвилинах, якщо до нього менше PRECISE_LEFT_HOURS; інакше null. */
export interface PreciseLeft {
  days: number;
  hours: number;
  minutes: number;
}

export function preciseLeft(due: number, now = new Date()): PreciseLeft | null {
  const sec = due - Math.floor(now.getTime() / 1000);
  if (sec <= 0 || sec >= PRECISE_LEFT_HOURS * 3600) return null;
  return { days: Math.floor(sec / 86400), hours: Math.floor((sec % 86400) / 3600), minutes: Math.floor((sec % 3600) / 60) };
}

/** Підпис біля великого числа: що саме показати, коли термін уже близько. */
export interface RailTime {
  big: string | number;
  cap: string;
  word: boolean;
}

/** «1 день 14 год», «5 год», «40 хв» — залишок словами, без «через». */
function leftText({ days, hours, minutes }: PreciseLeft): string {
  if (days > 0) return `${days} ${dayWord(days)}${hours ? ` ${hours} год` : ''}`;
  if (hours > 0) return `${hours} год`;
  return `${Math.max(1, minutes)} хв`;
}

/** Велике число й підпис у рейці дня; null — лишити звичайний підрахунок днів. */
export function railTime(due: number, calendarDays: number, now = new Date()): RailTime | null {
  const left = preciseLeft(due, now);
  if (!left) return null;
  if (calendarDays === 0) return { big: 'Сьогодні', cap: `ще ${leftText(left)}`, word: true };
  if (left.days === 0) {
    return left.hours > 0
      ? { big: left.hours, cap: 'год до здачі', word: false }
      : { big: Math.max(1, left.minutes), cap: 'хв до здачі', word: false };
  }
  return { big: left.days, cap: left.hours ? `${dayWord(left.days)} ${left.hours} год` : `${dayWord(left.days)} до здачі`, word: false };
}

/** Фраза для зведення: «сьогодні, ще 5 год», «через 1 день 14 год», «через 3 дні». */
export function whenText(due: number, calendarDays: number, now = new Date()): string {
  const left = preciseLeft(due, now);
  if (!left) return whenPhrase(calendarDays);
  return calendarDays === 0 ? `сьогодні, ще ${leftText(left)}` : `через ${leftText(left)}`;
}
