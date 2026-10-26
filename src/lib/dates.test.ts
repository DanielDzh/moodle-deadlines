import { describe, expect, it } from 'vitest';
import { dayWord, daysUntil, plural, whenPhrase } from './dates';

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
