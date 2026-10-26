import { describe, expect, it } from 'vitest';
import { buildReminderItems } from './reminders-sync';
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
