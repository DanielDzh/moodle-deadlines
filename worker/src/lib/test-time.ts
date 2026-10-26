/** Test helper: Unix time from Kyiv time in October and November 2026 (daylight saving is already over, UTC+2). */
export const kyiv = (day: number, hour: number, minute = 0, month = 10): number =>
  Date.UTC(2026, month - 1, day, hour - 2, minute) / 1000;
