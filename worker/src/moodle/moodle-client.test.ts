import { describe, expect, it } from 'vitest';
import { createMoodleClient, flatten, isAuthError, MoodleApiError } from './moodle-client';

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), { status: 200, ...init });
const clientWith = (respond: (url: string, init: RequestInit) => Response | Promise<Response>) =>
  createMoodleClient('https://m.edu', 'tok', (async (url: string, init: RequestInit) => respond(url, init)) as unknown as typeof fetch);

/** The error a call rejects with. */
const failure = async (promise: Promise<unknown>): Promise<MoodleApiError> => (await promise.catch((e) => e)) as MoodleApiError;

describe('flatten', () => {
  it('expands arrays and objects the way Moodle expects', () => {
    expect(flatten({ courseids: [1, 2], flag: true, a: { b: 'x' }, skip: undefined }).toString()).toBe(
      'courseids%5B0%5D=1&courseids%5B1%5D=2&flag=1&a%5Bb%5D=x',
    );
  });
});

describe('createMoodleClient', () => {
  it('posts the token and function to the web-service endpoint without following redirects', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const call = clientWith((url, init) => ((seen = { url, init }), json({ ok: 1 })));
    expect(await call('core_x', { id: 5 })).toEqual({ ok: 1 });
    expect(seen?.url).toBe('https://m.edu/webservice/rest/server.php');
    expect(seen?.init.redirect).toBe('manual');
    const body = String(seen?.init.body);
    expect(body).toContain('wstoken=tok');
    expect(body).toContain('wsfunction=core_x');
    expect(body).toContain('id=5');
  });

  it('turns Moodle exceptions into errors with the error code', async () => {
    const call = clientWith(() => json({ exception: 'moodle_exception', errorcode: 'invalidtoken', message: 'Invalid token' }));
    const error = await failure(call('x'));
    expect(error).toBeInstanceOf(MoodleApiError);
    expect(error.code).toBe('invalidtoken');
    expect(isAuthError(error)).toBe(true);
    expect(isAuthError(new MoodleApiError('network'))).toBe(false);
  });

  it('refuses redirects, oversized and garbled responses, and reports network failures', async () => {
    expect((await failure(clientWith(() => new Response(null, { status: 302, headers: { Location: 'http://10.0.0.1/' } }))('x'))).code).toBe('redirect');
    expect((await failure(clientWith(() => json({}, { headers: { 'Content-Length': String(50 * 1024 * 1024) } }))('x'))).code).toBe('too_large');
    expect((await failure(clientWith(() => new Response('x'.repeat(3 * 1024 * 1024)))('x'))).code).toBe('too_large');
    expect((await failure(clientWith(() => new Response('<html>not json</html>'))('x'))).code).toBe('bad_response');
    expect((await failure(clientWith(() => { throw new TypeError('fetch failed'); })('x'))).code).toBe('network');
  });
});
