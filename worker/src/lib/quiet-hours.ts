import type { QuietHours, TimeWindow } from '../types';

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (tz: string): Intl.DateTimeFormat => {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formatters.set(tz, f);
  }
  return f;
};

/** Whether the runtime knows this time zone (IANA). */
export const isValidTimeZone = (tz: string): boolean => {
  try {
    formatterFor(tz);
    return true;
  } catch {
    return false;
  }
};

/** Minutes since local midnight in the time zone tz. */
export const minutesOfDay = (epochSec: number, tz: string): number => {
  const parts = formatterFor(tz).formatToParts(new Date(epochSec * 1000));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
};

const inQuiet = (minutes: number, quiet: QuietHours): boolean =>
  minutes >= quiet.startHour * 60 || minutes < quiet.endHour * 60;

/** Whether the moment falls into quiet hours. */
export const isQuietAt = (epochSec: number, tz: string, quiet: QuietHours): boolean =>
  inQuiet(minutesOfDay(epochSec, tz), quiet);

/**
 * Bounds of the quiet window that contains the moment (start and end in Unix seconds), or null if the moment is not in quiet hours.
 * A daylight-saving change inside the window may shift the bounds by an hour: acceptable for reminders.
 */
export const quietWindowAround = (epochSec: number, tz: string, quiet: QuietHours): TimeWindow | null => {
  const m = minutesOfDay(epochSec, tz);
  if (!inQuiet(m, quiet)) return null;
  const start = quiet.startHour * 60;
  const end = quiet.endHour * 60;
  const day = 24 * 60;
  const sinceStart = m >= start ? m - start : m + (day - start);
  const untilEnd = m >= start ? day - m + end : end - m;
  return { start: epochSec - sinceStart * 60, end: epochSec + untilEnd * 60 };
};
