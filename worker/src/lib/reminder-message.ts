import { DELIVERY } from '../config';
import type { PlannedReminder } from '../types';
import type { InlineButton } from '../telegram/telegram-api';

const encoder = new TextEncoder();

/** "23 год", "2 год 15 хв", "40 хв": time left in words. */
export const formatLeft = (seconds: number): string => {
  const minutes = Math.max(1, Math.floor(seconds / 60));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} д${hours ? ` ${hours} год` : ''}`;
  if (hours > 0) return `${hours} год${mins ? ` ${mins} хв` : ''}`;
  return `${mins} хв`;
};

/** "пн, 27 жовтня о 23:59" in the student's time zone. */
export const formatDue = (due: number, tz: string): string => {
  const at = new Date(due * 1000);
  const day = new Intl.DateTimeFormat('uk-UA', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'long' }).format(at);
  const time = new Intl.DateTimeFormat('uk-UA', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  return `${day} о ${time}`;
};

const buttonFor = (action: 'done' | 'snooze', key: string): string | null => {
  const data = `${action}:${key}`;
  return encoder.encode(data).length <= DELIVERY.maxCallbackBytes ? data : null;
};

/** The Telegram message for one reminder (Ukrainian, plain text) and its buttons. */
export const buildReminderMessage = ({ task }: PlannedReminder, tz: string, now: number): { text: string; buttons: InlineButton[] } => {
  const lines = [`⏰ До дедлайну ${formatLeft(task.due - now)}`];
  if (task.course) lines.push(`📚 ${task.course}`);
  lines.push(`📝 ${task.name}`, `🗓 ${formatDue(task.due, tz)}`);
  if (task.url) lines.push(`🔗 ${task.url}`);

  const done = buttonFor('done', task.key);
  const snooze = buttonFor('snooze', task.key);
  const buttons: InlineButton[] = [];
  if (done) buttons.push({ text: '✅ Вже зробив', data: done });
  if (snooze) buttons.push({ text: '⏳ Пізніше', data: snooze });
  return { text: lines.join('\n'), buttons };
};
