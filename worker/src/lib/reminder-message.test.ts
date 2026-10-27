import { describe, expect, it } from 'vitest';
import type { PlannedReminder, PlannerTask } from '../types';
import { buildReminderMessage, formatDue, formatLeft } from './reminder-message';
import { kyiv } from './test-time';

const task = (over: Partial<PlannerTask> = {}): PlannerTask => ({
  key: 'assign-1', name: 'Lab 3', course: 'Databases', url: 'https://m.edu/x', due: kyiv(28, 14, 0),
  done: false, submitted: false, muted: false, snoozeUntil: 0, ...over,
});
const reminder = (t: PlannerTask): PlannedReminder => ({ task: t, kind: '24h' });

describe('formatLeft', () => {
  it.each([
    [40 * 60, '40 хв'], [3600, '1 год'], [3 * 3600 + 15 * 60, '3 год 15 хв'], [23 * 3600, '23 год'], [26 * 3600, '1 д 2 год'], [86400, '1 д'], [5, '1 хв'],
  ])('%i s → %s', (seconds, text) => expect(formatLeft(seconds)).toBe(text));
});

describe('formatDue', () => {
  it('uses the student\'s time zone', () => {
    expect(formatDue(kyiv(28, 14, 0), 'Europe/Kyiv')).toBe('ср, 28 жовтня о 14:00');
    expect(formatDue(kyiv(28, 14, 0), 'UTC')).toBe('ср, 28 жовтня о 12:00');
  });
});

describe('buildReminderMessage', () => {
  it('lists course, name, date and link, with two buttons', () => {
    const { text, buttons } = buildReminderMessage(reminder(task()), 'Europe/Kyiv', kyiv(27, 14, 0));
    expect(text).toBe('⏰ До дедлайну 1 д\n📚 Databases\n📝 Lab 3\n🗓 ср, 28 жовтня о 14:00\n🔗 https://m.edu/x');
    expect(buttons).toEqual([{ text: '✅ Вже зробив', data: 'done:assign-1' }, { text: '⏳ Пізніше', data: 'snooze:assign-1' }]);
  });

  it('skips empty course and link', () => {
    const { text } = buildReminderMessage(reminder(task({ course: '', url: '' })), 'Europe/Kyiv', kyiv(28, 11, 0));
    expect(text).toBe('⏰ До дедлайну 3 год\n📝 Lab 3\n🗓 ср, 28 жовтня о 14:00');
  });

  it('drops buttons whose callback data would exceed Telegram\'s 64 bytes', () => {
    const { buttons } = buildReminderMessage(reminder(task({ key: 'forum-' + 'x'.repeat(70) })), 'Europe/Kyiv', kyiv(27, 14, 0));
    expect(buttons).toEqual([]);
  });
});
