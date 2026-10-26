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
