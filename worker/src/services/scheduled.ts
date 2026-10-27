import { cleanup } from '../db/cleanup-repo';
import { createDeliveryRepo } from '../db/delivery-repo';
import { createRefreshRepo } from '../db/refresh-repo';
import { devSiteCheck } from '../lib/dev-site-check';
import { parseBlockedSites } from '../lib/site-url';
import { createTelegramClient } from '../telegram/telegram-api';
import type { Env } from '../types';
import { deliverReminders } from './deliver-reminders';
import { refreshNextUser } from './refresh-user';

/** Cleanup is cheap but pointless every minute. */
const CLEANUP_EVERY_MINUTES = 10;

/**
 * One cron tick (every minute). Each step is isolated: a failure in one never stops the others,
 * and errors are logged by name only because their messages could carry user data.
 */
export const runScheduled = async (env: Env, now: number = Math.floor(Date.now() / 1000)): Promise<void> => {
  const telegram = createTelegramClient(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_API_BASE);
  const steps: [string, () => Promise<unknown>][] = [
    ['deliver', async () => {
      const report = await deliverReminders(createDeliveryRepo(env.DB), telegram, now);
      if (report.sent || report.removed || report.failed || report.rateLimited) console.log('delivery', JSON.stringify(report));
    }],
    ['refresh', async () => {
      const outcome = await refreshNextUser(
        {
          repo: createRefreshRepo(env.DB),
          telegram,
          tokenKey: env.TOKEN_KEY,
          blockedSites: parseBlockedSites(env.BLOCKED_SITES),
          siteCheck: env.DEV_ALLOW_ANY_SITE === '1' ? devSiteCheck : undefined,
        },
        now,
      );
      if (outcome !== 'none') console.log('refresh', outcome);
    }],
  ];
  if (Math.floor(now / 60) % CLEANUP_EVERY_MINUTES === 0) {
    steps.push(['cleanup', async () => {
      const report = await cleanup(env.DB, now);
      if (Object.values(report).some(Boolean)) console.log('cleanup', JSON.stringify(report));
    }]);
  }
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      console.error(`${name} failed`, error instanceof Error ? error.name : 'unknown');
    }
  }
};
