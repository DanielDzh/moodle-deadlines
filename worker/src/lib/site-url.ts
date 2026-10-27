import type { SiteCheck } from '../types';

const MAX_LENGTH = 200;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
/** Suffixes that only make sense inside a private network. */
const PRIVATE_SUFFIXES = ['.local', '.localhost', '.internal', '.intranet', '.lan', '.home', '.corp', '.private', '.test', '.invalid'];

/**
 * Validates a Moodle address that a user asks the Worker to fetch (SSRF guard).
 * Only https, only a public-looking domain name, default port, no credentials.
 * Returns the normalised address (origin plus an optional sub-path, no trailing slash, no query).
 */
export const checkMoodleSite = (input: unknown, blocked: readonly string[] = []): SiteCheck => {
  if (typeof input !== 'string' || !input.trim() || input.length > MAX_LENGTH) return { ok: false, reason: 'invalid_site' };
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: 'invalid_site' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'https_required' };
  if (url.username || url.password) return { ok: false, reason: 'invalid_site' };
  if (url.port && url.port !== '443') return { ok: false, reason: 'invalid_site' };

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host.includes(':')) return { ok: false, reason: 'invalid_site' };
  if (/^\d+(\.\d+){3}$/.test(host) || /^[\d.]+$/.test(host)) return { ok: false, reason: 'invalid_site' };
  if (host === 'localhost' || PRIVATE_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, reason: 'invalid_site' };
  if (!host.split('.').every((label) => LABEL.test(label))) return { ok: false, reason: 'invalid_site' };
  if (blocked.some((b) => host === b || host.endsWith(`.${b}`))) return { ok: false, reason: 'blocked_site' };

  const path = url.pathname.replace(/\/+$/, '');
  return { ok: true, site: `https://${host}${path}` };
};

/** Parses the comma-separated BLOCKED_SITES variable. */
export const parseBlockedSites = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
