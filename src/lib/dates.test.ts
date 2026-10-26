import { describe, expect, it } from 'vitest';
import { dayWord, daysUntil, plural, railTime, whenPhrase, whenText } from './dates';

const ts = (d: Date) => Math.floor(d.getTime() / 1000);

describe('plural / dayWord', () => {
  it.each([
    [1, 'день'], [2, 'дні'], [4, 'дні'], [5, 'днів'], [11, 'днів'], [12, 'днів'], [14, 'днів'],
    [21, 'день'], [22, 'дні'], [25, 'днів'], [101, 'день'], [111, 'днів'], [0, 'днів'], [-3, 'дні'],
  ])('%i → %s', (n, word) => {
    expect(dayWord(n)).toBe(word);
  });

  it('працює для інших слів', () => {
    expect(plural(3, 'завдання', 'завдання', 'завдань')).toBe('завдання');
    expect(plural(7, 'завдання', 'завдання', 'завдань')).toBe('завдань');
  });
});

describe('daysUntil', () => {
  const now = new Date(2026, 9, 26, 22, 30); // 26 жовтня, пізній вечір

  it('рахує календарні дні, а не 24-годинні проміжки', () => {
    expect(daysUntil(ts(new Date(2026, 9, 27, 0, 10)), now)).toBe(1);
    expect(daysUntil(ts(new Date(2026, 9, 26, 23, 59)), now)).toBe(0);
    expect(daysUntil(ts(new Date(2026, 9, 25, 9, 0)), now)).toBe(-1);
  });

  it('переходить через межу місяця й року', () => {
    expect(daysUntil(ts(new Date(2026, 10, 2, 12)), now)).toBe(7);
    expect(daysUntil(ts(new Date(2027, 0, 1, 12)), now)).toBe(67);
  });
});

describe('whenPhrase', () => {
  it('сьогодні, завтра, через N днів', () => {
    expect(whenPhrase(0)).toBe('сьогодні');
    expect(whenPhrase(1)).toBe('завтра');
    expect(whenPhrase(3)).toBe('через 3 дні');
    expect(whenPhrase(5)).toBe('через 5 днів');
  });
});

describe('залишок до годин', () => {
  const now = new Date(2026, 9, 26, 10, 0);
  const at = (d: number, h: number, m = 0) => ts(new Date(2026, 9, d, h, m));
  const cal = (due: number) => daysUntil(due, now);

  it('завтра 23:59 о 10:00 — це 1 день 13 год, а не просто «1 день»', () => {
    const due = at(27, 23, 59);
    expect(railTime(due, cal(due), now)).toEqual({ big: 1, cap: 'день 13 год', word: false });
    expect(whenText(due, cal(due), now)).toBe('через 1 день 13 год');
  });
  it('сьогодні — «Сьогодні» і скільки лишилось', () => {
    expect(railTime(at(26, 23, 59), 0, now)).toEqual({ big: 'Сьогодні', cap: 'ще 13 год', word: true });
    expect(railTime(at(26, 10, 40), 0, now)).toEqual({ big: 'Сьогодні', cap: 'ще 40 хв', word: true });
    expect(whenText(at(26, 18), 0, now)).toBe('сьогодні, ще 8 год');
  });
  it('завтра зранку, менше доби — лише години', () => {
    const due = at(27, 6);
    expect(railTime(due, cal(due), now)).toEqual({ big: 20, cap: 'год до здачі', word: false });
    expect(whenText(due, cal(due), now)).toBe('через 20 год');
  });
  it('рівно на добу без годин', () => {
    const due = at(27, 10);
    expect(railTime(due, cal(due), now)).toEqual({ big: 1, cap: 'день до здачі', word: false });
  });
  it('далі за 72 години — звичайні дні, прострочене не чіпаємо', () => {
    const due = at(30, 12);
    expect(railTime(due, cal(due), now)).toBeNull();
    expect(whenText(due, cal(due), now)).toBe('через 4 дні');
    expect(railTime(at(26, 9), 0, now)).toBeNull();
  });
});
