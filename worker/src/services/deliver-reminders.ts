import { DELIVERY } from '../config';
import { buildReminderMessage } from '../lib/reminder-message';
import { planReminders } from '../lib/reminder-planner';
import type { PlannedReminder, PlannerTask } from '../types';
import type { TelegramClient } from '../telegram/telegram-api';

/** One user's upcoming tasks and what was already sent for them. */
export interface UserBatch {
  userId: string;
  chatId: number;
  tz: string;
  tasks: PlannerTask[];
  /** Keys from sentKey(). */
  sent: ReadonlySet<string>;
}

export interface DeliveryRepo {
  loadBatches: (now: number, horizonSec: number) => Promise<UserBatch[]>;
  markSent: (userId: string, reminder: PlannedReminder, now: number) => Promise<void>;
  /** The user blocked the bot or the chat is gone: remove their data. */
  deleteUser: (userId: string) => Promise<void>;
}

export interface DeliveryReport {
  sent: number;
  removed: number;
  failed: number;
  rateLimited: boolean;
}

/**
 * Sends the reminders that are due now. At-least-once: a reminder is marked sent only after Telegram accepted it,
 * so a failure is retried on the next tick. Stops early when Telegram asks us to slow down.
 */
export const deliverReminders = async (repo: DeliveryRepo, telegram: TelegramClient, now: number): Promise<DeliveryReport> => {
  const report: DeliveryReport = { sent: 0, removed: 0, failed: 0, rateLimited: false };
  for (const batch of await repo.loadBatches(now, DELIVERY.horizonSec)) {
    const due = planReminders({ tasks: batch.tasks, sent: batch.sent, now, tz: batch.tz })
      .sort((a, b) => a.task.due - b.task.due)
      .slice(0, DELIVERY.maxPerUserPerTick);

    for (const reminder of due) {
      const { text, buttons } = buildReminderMessage(reminder, batch.tz, now);
      const result = await telegram.sendMessage(batch.chatId, text, buttons);
      if (result.ok) {
        await repo.markSent(batch.userId, reminder, now);
        report.sent++;
        continue;
      }
      if (result.reason === 'rate_limited') {
        report.rateLimited = true;
        return report;
      }
      if (result.reason === 'blocked') {
        await repo.deleteUser(batch.userId);
        report.removed++;
      } else {
        report.failed++;
      }
      break; // do not hammer a failing chat with the rest of its reminders
    }
  }
  return report;
};
