import { describe, expect, it } from 'vitest';
import { QUIET_HOURS } from '../config';
import { isQuietAt, isValidTimeZone, minutesOfDay, quietWindowAround } from './quiet-hours';
import { kyiv } from './test-time';

const TZ = 'Europe/Kyiv';

describe('time zone', () => {
  it('recognises IANA zones and rejects garbage', () => {
    expect(isValidTimeZone('Europe/Kyiv')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('counts minutes since local midnight', () => {
    expect(minutesOfDay(kyiv(27, 8, 30), TZ)).toBe(8 * 60 + 30);
    expect(minutesOfDay(kyiv(27, 0, 5), TZ)).toBe(5);
  });
});

describe('quiet hours 23:00–08:00', () => {
  it.each([
    [22, 59, false], [23, 0, true], [3, 0, true], [7, 59, true], [8, 0, false], [12, 0, false],
  ])('%i:%i → quiet: %s', (h, m, quiet) => {
    expect(isQuietAt(kyiv(27, h, m), TZ, QUIET_HOURS)).toBe(quiet);
  });

  it('window bounds: evening part', () => {
    expect(quietWindowAround(kyiv(26, 23, 30), TZ, QUIET_HOURS)).toEqual({ start: kyiv(26, 23, 0), end: kyiv(27, 8, 0) });
  });

  it('window bounds: night part after midnight', () => {
    expect(quietWindowAround(kyiv(27, 2, 0), TZ, QUIET_HOURS)).toEqual({ start: kyiv(26, 23, 0), end: kyiv(27, 8, 0) });
  });

  it('no window outside quiet hours', () => {
    expect(quietWindowAround(kyiv(27, 12, 0), TZ, QUIET_HOURS)).toBeNull();
  });
});
