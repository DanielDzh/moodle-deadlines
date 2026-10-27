import { TEXTS } from '../bot/texts';
import { checkMoodleSite } from '../lib/site-url';
import { decryptToken } from '../lib/token-crypto';
import { collectTasks, type Collected } from '../moodle/collect-tasks';
import { createMoodleClient, isAuthError, type MoodleCall } from '../moodle/moodle-client';
import type { TelegramClient } from '../telegram/telegram-api';

export interface RefreshTarget {
  id: string;
  site: string;
  tokenEnc: string;
  chatId: number | null;
}

export interface RefreshRepo {
  /** The active user whose data is the most overdue for a refresh, or null. */
  nextTarget: (now: number) => Promise<RefreshTarget | null>;
  /** Stores the tasks and records a successful fetch. */
  saveTasks: (userId: string, collected: Collected, now: number) => Promise<void>;
  /** Records a failed fetch so the next attempt waits longer. */
  markFailed: (userId: string, now: number) => Promise<void>;
  /** Pauses reminders and deletes the stored token: it no longer works or must not be used. */
  pause: (userId: string) => Promise<void>;
}

export interface RefreshDeps {
  repo: RefreshRepo;
  telegram: TelegramClient;
  tokenKey: string;
  blockedSites: readonly string[];
  /** Replaces the Moodle address check. For local development only. */
  siteCheck?: typeof checkMoodleSite;
  makeCall?: (site: string, token: string) => MoodleCall;
}

export type RefreshOutcome = 'none' | 'refreshed' | 'auth_expired' | 'paused' | 'failed';

/**
 * Refreshes one user's tasks from Moodle. Called once per cron tick, so Moodle sees at most one user per minute from us.
 * Never logs error messages: they could contain the token or the user's data.
 */
export const refreshNextUser = async (deps: RefreshDeps, now: number): Promise<RefreshOutcome> => {
  const target = await deps.repo.nextTarget(now);
  if (!target) return 'none';

  const site = (deps.siteCheck ?? checkMoodleSite)(target.site, deps.blockedSites);
  if (!site.ok) {
    await deps.repo.pause(target.id);
    return 'paused';
  }

  let token: string;
  try {
    token = await decryptToken(target.tokenEnc, deps.tokenKey, target.id);
  } catch {
    await deps.repo.pause(target.id);
    return 'paused';
  }

  try {
    const call = (deps.makeCall ?? createMoodleClient)(site.site, token);
    await deps.repo.saveTasks(target.id, await collectTasks(call, site.site, now), now);
    return 'refreshed';
  } catch (error) {
    if (isAuthError(error)) {
      await deps.repo.pause(target.id);
      if (target.chatId !== null) await deps.telegram.sendMessage(target.chatId, TEXTS.authExpired);
      return 'auth_expired';
    }
    await deps.repo.markFailed(target.id, now);
    return 'failed';
  }
};
