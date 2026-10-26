import { describe, expect, it } from 'vitest';
import type { PlannerTask } from '../types';
import { planReminders, sentKey } from './reminder-planner';
import { kyiv } from './test-time';

const TZ = 'Europe/Kyiv';

const task = (over: Partial<PlannerTask> = {}): PlannerTask => ({
  key: 'assign-1',
  name: 'Lab 3',
  course: 'Databases',
  url: 'https://m.edu/mod/assign/view.php?id=1',
  due: kyiv(28, 14, 0),
  done: false,
  submitted: false,
  muted: false,
  ...over,
});

const plan = (t: PlannerTask, now: number, sent: string[] = []) =>
  planReminders({ tasks: [t], sent: new Set(sent), now, tz: TZ }).map((r) => r.kind);

describe('reminder planner', () => {
  it('sends 24h a day before the deadline, stays silent earlier', () => {
    expect(plan(task(), kyiv(27, 13, 59))).toEqual([]);
    expect(plan(task(), kyiv(27, 14, 0))).toEqual(['24h']);
  });

  it('sends only 3h at three hours, even if 24h was never sent', () => {
    expect(plan(task(), kyiv(28, 11, 0))).toEqual(['3h']);
  });

  it('waits for 3h after 24h was sent', () => {
    const sent = [sentKey('assign-1', kyiv(28, 14, 0), '24h')];
    expect(plan(task(), kyiv(27, 18, 0), sent)).toEqual([]);
    expect(plan(task(), kyiv(28, 11, 0), sent)).toEqual(['3h']);
  });

  it('does not repeat what was already sent', () => {
    const sent = [sentKey('assign-1', kyiv(28, 14, 0), '3h')];
    expect(plan(task(), kyiv(28, 12, 0), sent)).toEqual([]);
  });

  it('if the task was discovered 2 hours before, sends only 3h', () => {
    expect(plan(task(), kyiv(28, 12, 0))).toEqual(['3h']);
  });

  it('a moved deadline gives new reminders', () => {
    const sent = [sentKey('assign-1', kyiv(28, 14, 0), '24h')];
    const moved = task({ due: kyiv(30, 14, 0) });
    expect(plan(moved, kyiv(29, 14, 0), sent)).toEqual(['24h']);
  });

  it.each([
    ['done', { done: true }],
    ['submitted', { submitted: true }],
    ['muted with the button', { muted: true }],
    ['without a deadline', { due: 0 }],
    ['overdue', { due: kyiv(27, 10, 0) }],
  ] as const)('skips %s', (_name, over) => {
    expect(plan(task(over), kyiv(27, 15, 0))).toEqual([]);
  });

  describe('quiet hours', () => {
    it('a night reminder moves to 08:00 if the deadline is later', () => {
      const t = task({ due: kyiv(27, 10, 0) }); // 3h falls at 07:00
      const sent = [sentKey('assign-1', kyiv(27, 10, 0), '24h')];
      expect(plan(t, kyiv(27, 7, 30), sent)).toEqual([]);
      expect(plan(t, kyiv(27, 8, 0), sent)).toEqual(['3h']);
    });

    it('morning deadline: the reminder goes out in the evening before quiet hours', () => {
      const t = task({ due: kyiv(27, 5, 0) }); // 3h would fall at 02:00
      const sent = [sentKey('assign-1', kyiv(27, 5, 0), '24h')];
      expect(plan(t, kyiv(26, 22, 54), sent)).toEqual([]);
      expect(plan(t, kyiv(26, 22, 56), sent)).toEqual(['3h']);
    });

    it('sends nothing during quiet hours', () => {
      const t = task({ due: kyiv(27, 5, 0) });
      expect(plan(t, kyiv(27, 1, 0))).toEqual([]);
    });
  });

  it('handles several tasks independently', () => {
    const a = task({ key: 'a', due: kyiv(28, 14, 0) });
    const b = task({ key: 'b', due: kyiv(28, 20, 0) });
    const result = planReminders({ tasks: [a, b], sent: new Set(), now: kyiv(27, 14, 0), tz: TZ });
    expect(result.map((r) => r.task.key)).toEqual(['a']);
  });
});
