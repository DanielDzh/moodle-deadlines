import { MOODLE } from '../config';

/** An error reported by Moodle (code is its errorcode) or raised while talking to it. */
export class MoodleApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** The token is stale or revoked: the user has to log in on the site again. */
export const isAuthError = (error: unknown): boolean =>
  error instanceof MoodleApiError && (error.code === 'invalidtoken' || error.code === 'accessexception');

export type MoodleCall = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;

/** { courseids: [1, 2] } → courseids[0]=1&courseids[1]=2, the way Moodle expects arrays and objects. */
export const flatten = (obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') flatten(v as Record<string, unknown>, key, out);
    else if (v !== undefined) out.append(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return out;
};

/** Reads a response body but gives up beyond maxBytes, so a hostile server cannot make the Worker buffer gigabytes. */
const readLimited = async (response: Response, maxBytes: number): Promise<string> => {
  const declared = Number(response.headers.get('Content-Length') ?? 0);
  if (declared > maxBytes) throw new MoodleApiError('too_large');
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new MoodleApiError('too_large');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
};

/**
 * A Moodle web-service client for the Worker. The site address was validated when the user linked,
 * and requests never follow redirects (a redirect could point at an internal address).
 */
export const createMoodleClient = (site: string, token: string, doFetch: typeof fetch = fetch): MoodleCall =>
  async <T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
    const body = flatten(args);
    body.append('wstoken', token);
    body.append('wsfunction', fn);
    body.append('moodlewsrestformat', 'json');

    let response: Response;
    try {
      response = await doFetch(`${site}/webservice/rest/server.php`, {
        method: 'POST',
        body,
        redirect: 'manual',
        headers: { 'User-Agent': MOODLE.userAgent },
        signal: AbortSignal.timeout(MOODLE.requestTimeoutMs),
      });
    } catch {
      throw new MoodleApiError('network');
    }
    if (response.status >= 300 && response.status < 400) throw new MoodleApiError('redirect');

    let data: unknown;
    try {
      data = JSON.parse(await readLimited(response, MOODLE.maxResponseBytes));
    } catch (error) {
      throw error instanceof MoodleApiError ? error : new MoodleApiError('bad_response');
    }
    if (data && typeof data === 'object' && 'exception' in data) {
      throw new MoodleApiError(String((data as { errorcode?: unknown }).errorcode ?? 'moodle_error'));
    }
    return data as T;
  };
