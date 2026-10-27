import { describe, expect, it } from 'vitest';
import { localDayHour, shiftDay } from './local-time';
import { kyiv } from './test-time';

describe('localDayHour', () => {
  it('uses the time zone for both the day and the hour', () => {
    expect(localDayHour(kyiv(27, 14, 30), 'Europe/Kyiv')).toEqual({ day: '2026-10-27', hour: 14 });
    expect(localDayHour(kyiv(27, 0, 5), 'Europe/Kyiv')).toEqual({ day: '2026-10-27', hour: 0 });
    expect(localDayHour(kyiv(27, 23, 59), 'Europe/Kyiv')).toEqual({ day: '2026-10-27', hour: 23 });
    // 23:30 in Kyiv is already the next day in Tokyo
    expect(localDayHour(kyiv(27, 23, 30), 'Asia/Tokyo')).toEqual({ day: '2026-10-28', hour: 6 });
  });
});

describe('shiftDay', () => {
  it('moves across month and year boundaries', () => {
    expect(shiftDay('2026-10-27', -2)).toBe('2026-10-25');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2026-12-30', 3)).toBe('2027-01-02');
  });
});
