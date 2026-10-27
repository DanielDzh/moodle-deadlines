import { INACTIVE_USER_DAYS, INACTIVITY_BATCH, INACTIVITY_WARN_DAYS } from '../config';
import { TEXTS } from '../bot/texts';
import type { TelegramClient } from '../telegram/telegram-api';

export interface InactiveUser {
  id: string;
  chatId: number;
}

export interface InactivityRepo {
  /** Active users with a chat whose last visit is in [notOlderThan, before) and who were not yet warned since that visit. */
  dueForWarning: (before: number, notOlderThan: number, limit: number) => Promise<InactiveUser[]>;
  markWarned: (userId: string, now: number) => Promise<void>;
  /** Active users with a chat whose last visit is older than `before`. */
  dueForExpiry: (before: number, limit: number) => Promise<InactiveUser[]>;
  deleteUser: (userId: string) => Promise<void>;
}

export interface InactivityReport {
  warned: number;
  expired: number;
}

const DAY = 86_400;

/**
 * Warns users a week before their subscription is removed for not visiting the site, and says so when it is removed.
 * Visiting the site resets the clock (the site's sync updates last_seen_at), and a later inactivity gets a new warning.
 * A failed send is retried on the next tick; a blocked bot just means the data is removed.
 */
export const notifyInactive = async (repo: InactivityRepo, telegram: TelegramClient, siteUrl: string, now: number): Promise<InactivityReport> => {
  const report: InactivityReport = { warned: 0, expired: 0 };

  for (const user of await repo.dueForExpiry(now - INACTIVE_USER_DAYS * DAY, INACTIVITY_BATCH)) {
    const result = await telegram.sendMessage(user.chatId, TEXTS.inactivityExpired);
    if (!result.ok && result.reason === 'rate_limited') return report;
    if (result.ok || result.reason === 'blocked') {
      await repo.deleteUser(user.id);
      report.expired++;
    }
  }

  const warnBefore = now - (INACTIVE_USER_DAYS - INACTIVITY_WARN_DAYS) * DAY;
  const expireBefore = now - INACTIVE_USER_DAYS * DAY;
  // Those already past the deadline (their final notice failed) must not be told "in 7 days".
  for (const user of await repo.dueForWarning(warnBefore, expireBefore, INACTIVITY_BATCH)) {
    const result = await telegram.sendMessage(user.chatId, TEXTS.inactivityWarning(siteUrl, INACTIVITY_WARN_DAYS));
    if (!result.ok && result.reason === 'rate_limited') return report;
    if (result.ok) {
      await repo.markWarned(user.id, now);
      report.warned++;
    } else if (result.reason === 'blocked') {
      await repo.deleteUser(user.id);
    }
  }
  return report;
};
