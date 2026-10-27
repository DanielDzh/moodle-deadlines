import { KEYS, REMINDERS, REMINDERS_API_URL } from '../config';
import type { LinkStatus, ReminderItem } from '../types';
import { local } from './storage';

/** An error from the reminders service; code is a stable identifier (see REMINDER_TEXTS.errors). */
export class RemindersError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** The browser's random sync key (the service sees only its hash). Created on first use and kept in localStorage. */
export const ensureSyncKey = (): string => {
  const existing = local.get<string>(KEYS.syncKey, '');
  if (existing) return existing;
  const key = toBase64Url(crypto.getRandomValues(new Uint8Array(REMINDERS.keyBytes)));
  local.set(KEYS.syncKey, key);
  return key;
};

export const hasSyncKey = (): boolean => !!local.get<string>(KEYS.syncKey, '');

interface RequestOptions {
  method: 'GET' | 'POST';
  body?: unknown;
  key?: string;
}

const request = async <T>(path: string, { method, body, key }: RequestOptions): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMINDERS.requestTimeoutMs);
  try {
    const response = await fetch(`${REMINDERS_API_URL}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
    if (!response.ok) throw new RemindersError(data.error ?? 'server_error');
    return data;
  } catch (error) {
    if (error instanceof RemindersError) throw error;
    throw new RemindersError('network');
  } finally {
    clearTimeout(timer);
  }
};

export interface LinkStartResult {
  code: string;
  expiresAt: number;
  botUrl: string;
}

/** Starts linking: the service stores the Moodle token encrypted and returns the t.me link with a one-time code. */
export const linkStart = (site: string, token: string): Promise<LinkStartResult> =>
  request<LinkStartResult>('/api/link/start', {
    method: 'POST',
    body: { site, token, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, syncKey: ensureSyncKey() },
  });

export const fetchLinkStatus = async (): Promise<LinkStatus> => {
  const status = await request<Partial<LinkStatus> & Pick<LinkStatus, 'state'>>('/api/link/status', { method: 'GET', key: ensureSyncKey() });
  return { state: status.state, done: Array.isArray(status.done) ? status.done : [] };
};

export const pushItems = (items: ReminderItem[]): Promise<{ ok: boolean; tracked: number }> =>
  request('/api/sync', { method: 'POST', body: { items }, key: ensureSyncKey() });

/** Deletes everything the service holds for this browser. */
export const unlink = async (): Promise<void> => {
  await request('/api/unlink', { method: 'POST', body: {}, key: ensureSyncKey() });
};
