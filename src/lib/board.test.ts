import { describe, expect, it } from 'vitest';
import type { Snapshot, Task } from '../types';
import { buildBoard, decorate, semesterEnd } from './board';

const now = new Date(2026, 9, 26, 9, 0); // пн, 26 жовтня 2026, 9:00
const at = (days: number, hour = 23, minute = 59) =>
  Math.floor(new Date(2026, 9, 26 + days, hour, minute).getTime() / 1000);

const task = (over: Partial<Task>): Task => ({
  key: over.key ?? `assign-${Math.random()}`,
  kind: 'assign',
  courseid: 1,
  cmid: 1,
  name: 'Завдання',
  due: 0,
  open: 0,
  cutoff: 0,
  intro: '',
  url: 'https://moodle.uni.edu/mod/assign/view.php?id=1',
  status: 'new',
  ...over,
});

const semEnd = at(60);

describe('decorate: смуги', () => {
  it.each([
    [at(-1), 'overdue'],
    [at(0, 8, 0), 'overdue'], // сьогодні, але година вже минула
    [at(0), 'week'],
    [at(7), 'week'],
    [at(8), 'month'],
    [at(31), 'month'],
    [at(45), 'semester'],
    [at(90), 'later'],
    [0, 'none'],
  ] as const)('термін %i → %s', (due, band) => {
    expect(decorate(task({ due }), semEnd, now).band).toBe(band);
  });
});

describe('semesterEnd', () => {
  it('бере найчастішу дату завершення курсів', () => {
    const end = at(70);
    const courses = [1, 2, 3].map((id) => ({ id, name: '', short: '', start: 0, end: id === 3 ? at(100) : end, color: '' }));
    expect(semesterEnd(courses, now)).toBe(end);
  });

  it('без дат у курсах — 31 січня наступного року (осінній семестр)', () => {
    const d = new Date(semesterEnd([], now) * 1000);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 31]);
  });
});

describe('buildBoard', () => {
  const snapshot: Snapshot = {
    v: 2,
    collectedAt: 0,
    base: 'https://moodle.uni.edu',
    user: 'Тест',
    courses: [
      { id: 1, name: 'Історія', short: '', start: 0, end: 0, color: '' },
      { id: 2, name: 'Мова', short: '', start: 0, end: 0, color: '' },
    ],
    items: [
      task({ key: 'a', due: at(1), courseid: 1 }),
      task({ key: 'b', due: at(1), courseid: 2, status: 'submitted' }),
      task({ key: 'c', due: at(5), courseid: 2 }),
      task({ key: 'd', due: at(-2), courseid: 1 }),
      task({ key: 'e', due: 0, courseid: 1, kind: 'forum', status: '' }),
    ],
  };
  const opts = { done: {}, filter: [], hideDone: false, hideSubmitted: true, burnDays: 2, now };

  it('ховає подані за замовчуванням і групує за днями', () => {
    const b = buildBoard(snapshot, opts);
    expect(b.bands.map((x) => x.id)).toEqual(['overdue', 'week', 'none']);
    const week = b.bands.find((x) => x.id === 'week')!;
    expect(week.items.map((t) => t.key)).toEqual(['a', 'c']);
    expect(week.groups).toHaveLength(2);
  });

  it('зведення: найближчий неподаний дедлайн і лічильники', () => {
    const b = buildBoard(snapshot, opts);
    expect(b.summary.next?.key).toBe('a');
    expect(b.summary.in7).toBe(2);
    expect(b.summary.overdue).toBe(1);
    expect(b.summary.total).toBe(5);
  });

  it('горить лише неподане й невиконане в межах порогу', () => {
    const b = buildBoard(snapshot, opts);
    const byKey = Object.fromEntries(b.all.map((t) => [t.key, t]));
    expect(b.isBurning(byKey.a)).toBe(true);
    expect(b.isBurning(byKey.b)).toBe(false); // подано
    expect(b.isBurning(byKey.c)).toBe(false); // 5 днів > порогу
    expect(b.isBurning(byKey.d)).toBe(false); // прострочено
    expect(buildBoard(snapshot, { ...opts, burnDays: 7 }).isBurning(byKey.c)).toBe(true);
    expect(buildBoard(snapshot, { ...opts, done: { a: true } }).isBurning(byKey.a)).toBe(false);
  });

  it('фільтр за курсом і невідомі id у фільтрі ігноруються', () => {
    const b = buildBoard(snapshot, { ...opts, filter: [2, 999] });
    expect([...b.filter]).toEqual([2]);
    expect(b.bands.flatMap((x) => x.items.map((t) => t.key))).toEqual(['c']);
  });

  it('«Приховати виконані» ховає позначені вручну', () => {
    const b = buildBoard(snapshot, { ...opts, done: { a: true }, hideDone: true });
    expect(b.bands.flatMap((x) => x.items.map((t) => t.key))).not.toContain('a');
  });
});
