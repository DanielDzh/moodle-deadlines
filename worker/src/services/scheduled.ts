import { createDeliveryRepo } from '../db/delivery-repo';
import { createTelegramClient } from '../telegram/telegram-api';
import type { Env } from '../types';
import { deliverReminders } from './deliver-reminders';

/**
 * One cron tick (every minute). Each step is isolated: a failure in one never stops the others,
 * and errors are logged by name only because their messages could carry user data.
 */
export const runScheduled = async (env: Env, now: number = Math.floor(Date.now() / 1000)): Promise<void> => {
  const steps: [string, () => Promise<unknown>][] = [
    ['deliver', async () => {
      const report = await deliverReminders(createDeliveryRepo(env.DB), createTelegramClient(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_API_BASE), now);
      if (report.sent || report.removed || report.failed || report.rateLimited) console.log('delivery', JSON.stringify(report));
    }],
  ];
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      console.error(`${name} failed`, error instanceof Error ? error.name : 'unknown');
    }
  }
};
