import { ANALYTICS_URL, KEYS, REMINDERS, type AnalyticsEvent } from '../config';
import { local } from './storage';

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A random id that lives only in this browser; the server stores just a hash of it. */
const visitorId = (): string => {
  const existing = local.get<string>(KEYS.visitorId, '');
  if (existing) return existing;
  const id = toBase64Url(crypto.getRandomValues(new Uint8Array(REMINDERS.keyBytes)));
  local.set(KEYS.visitorId, id);
  return id;
};

/** Do Not Track, Global Privacy Control or the "do not count me" switch on the privacy page. */
export const statsDisabled = (): boolean => {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true || local.get<boolean>(KEYS.noStats, false) === true;
};

/**
 * Counts one anonymous event. Fire and forget: statistics never block the page and never show an error.
 * Sent as text/plain so the browser makes a plain request without a CORS preflight.
 */
export const track = (event: AnalyticsEvent): void => {
  if (statsDisabled()) return;
  try {
    void fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ id: visitorId(), event }),
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }).catch(() => undefined);
  } catch {
    /* no fetch, no storage: nothing to count */
  }
};
