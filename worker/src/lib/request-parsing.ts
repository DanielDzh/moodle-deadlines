import { LIMITS, MAX_DUE, PATTERNS } from '../config';
import type { LinkStartInput, ParseResult, SyncTask } from '../types';
import { isValidTimeZone } from './quiet-hours';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.trim().slice(0, max) : null;

/** The browser's sync key from `Authorization: Bearer <key>`, or null. */
export const parseBearer = (request: Request): string | null => {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer (\S+)$/.exec(header);
  return match && PATTERNS.syncKey.test(match[1]) ? match[1] : null;
};

/** Validates the body of POST /api/link/start (the address itself is checked separately). */
export const parseLinkStart = (body: unknown): ParseResult<LinkStartInput> => {
  if (!isRecord(body)) return { ok: false, error: 'invalid_body' };
  const { site, token, tz, syncKey } = body;
  if (typeof site !== 'string') return { ok: false, error: 'invalid_site' };
  if (typeof token !== 'string' || !PATTERNS.moodleToken.test(token)) return { ok: false, error: 'invalid_token' };
  if (typeof tz !== 'string' || !isValidTimeZone(tz)) return { ok: false, error: 'invalid_timezone' };
  if (typeof syncKey !== 'string' || !PATTERNS.syncKey.test(syncKey)) return { ok: false, error: 'invalid_sync_key' };
  return { ok: true, value: { site, token, tz, syncKey } };
};

const safeUrl = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > LIMITS.maxUrlLength) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
};

/** Validates the body of POST /api/sync. Any malformed item rejects the whole request. */
export const parseSync = (body: unknown): ParseResult<SyncTask[]> => {
  if (!isRecord(body) || !Array.isArray(body.items)) return { ok: false, error: 'invalid_body' };
  if (body.items.length > LIMITS.maxTasks) return { ok: false, error: 'too_many_items' };
  const tasks: SyncTask[] = [];
  const seen = new Set<string>();
  for (const raw of body.items) {
    if (!isRecord(raw)) return { ok: false, error: 'invalid_item' };
    const key = typeof raw.key === 'string' && PATTERNS.taskKey.test(raw.key) ? raw.key : null;
    const name = text(raw.name, LIMITS.maxNameLength);
    const course = text(raw.course, LIMITS.maxCourseLength);
    const due = raw.due;
    if (!key || !name || course === null) return { ok: false, error: 'invalid_item' };
    if (typeof due !== 'number' || !Number.isInteger(due) || due <= 0 || due > MAX_DUE) return { ok: false, error: 'invalid_item' };
    if (typeof raw.done !== 'boolean' || typeof raw.submitted !== 'boolean') return { ok: false, error: 'invalid_item' };
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push({ key, name, course, url: safeUrl(raw.url), due, done: raw.done, submitted: raw.submitted });
  }
  return { ok: true, value: tasks };
};
