/** The local date (YYYY-MM-DD) and hour (0-23) of a moment in a time zone. */
export const localDayHour = (epochSec: number, tz: string): { day: string; hour: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(epochSec * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
};

/** The local date n days before the given day (YYYY-MM-DD). Calendar arithmetic, so daylight saving cannot skew it. */
export const shiftDay = (day: string, deltaDays: number): string => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
};
