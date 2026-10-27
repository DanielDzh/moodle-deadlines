import { describe, expect, it } from 'vitest';
import { buildReminderItems, mergeRemoteDone, sameKeys } from './reminders-sync';
import type { Snapshot, Task } from '../types';

const NOW = 1_800_000_000;
const task = (over: Partial<Task>): Task => ({
  key: 'assign-1', kind: 'assign', courseid: 1, cmid: 1, name: 'Lab 3', due: NOW + 3600, open: 0, cutoff: 0, intro: '', url: 'https://m.edu/x', status: 'new', ...over,
});
const snapshot = (items: Task[]): Snapshot => ({
  v: 2, collectedAt: NOW, base: 'https://m.edu', user: 'U',
  courses: [{ id: 1, name: 'Databases', short: 'DB', start: 0, end: 0, color: '' }], items,
});

describe('buildReminderItems', () => {
  it('sends upcoming tasks with the course name and the done / submitted flags', () => {
    const items = buildReminderItems(snapshot([task({}), task({ key: 'b', status: 'submitted' })]), { b: true }, NOW);
    expect(items).toEqual([
      { key: 'assign-1', name: 'Lab 3', course: 'Databases', url: 'https://m.edu/x', due: NOW + 3600, done: false, submitted: false },
      { key: 'b', name: 'Lab 3', course: 'Databases', url: 'https://m.edu/x', due: NOW + 3600, done: true, submitted: true },
    ]);
  });

  it('skips overdue and undated tasks', () => {
    const items = buildReminderItems(snapshot([task({ due: NOW - 1 }), task({ key: 'c', due: 0 }), task({ key: 'd', due: NOW })]), {}, NOW);
    expect(items).toEqual([]);
  });

  it('treats graded as submitted and tolerates an unknown course', () => {
    const items = buildReminderItems(snapshot([task({ status: 'graded', courseid: 99 })]), {}, NOW);
    expect(items[0]).toMatchObject({ submitted: true, course: '' });
  });
});

describe('mergeRemoteDone', () => {
  it('ticks the tasks the bot marked done and keeps the existing ticks', () => {
    expect(mergeRemoteDone({ a: true }, ['b', 'c'])).toEqual({ a: true, b: true, c: true });
  });

  it('never removes a tick the site has', () => {
    expect(mergeRemoteDone({ a: true, b: true }, [])).toEqual({ a: true, b: true });
  });

  it('returns the same object when there is nothing new, so no re-render happens', () => {
    const done = { a: true };
    expect(mergeRemoteDone(done, ['a'])).toBe(done);
    expect(mergeRemoteDone(done, [])).toBe(done);
  });

  it('does not mutate its input', () => {
    const done = { a: true };
    mergeRemoteDone(done, ['b']);
    expect(done).toEqual({ a: true });
  });
});

describe('sameKeys', () => {
  it('compares as sets, ignoring order', () => {
    expect(sameKeys(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameKeys(['a'], ['a', 'b'])).toBe(false);
    expect(sameKeys([], [])).toBe(true);
  });
});
