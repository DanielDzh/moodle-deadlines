import { describe, expect, it } from 'vitest';
import { parseBearer, parseLinkStart, parseSync } from './request-parsing';

const KEY = 'k'.repeat(40);
const TOKEN = 'f3a1c9d2e4b5a6978877665544332211';
const item = (over: Record<string, unknown> = {}) => ({
  key: 'assign-1', name: 'Lab 3', course: 'Databases', url: 'https://m.edu/x', due: 1_800_000_000, done: false, submitted: false, ...over,
});

describe('parseBearer', () => {
  const req = (auth?: string) => new Request('https://w.example', { headers: auth ? { Authorization: auth } : {} });
  it('reads a well-formed key and rejects the rest', () => {
    expect(parseBearer(req(`Bearer ${KEY}`))).toBe(KEY);
    expect(parseBearer(req())).toBeNull();
    expect(parseBearer(req('Bearer short'))).toBeNull();
    expect(parseBearer(req(`Basic ${KEY}`))).toBeNull();
    expect(parseBearer(req(`Bearer ${KEY} extra`))).toBeNull();
  });
});

describe('parseLinkStart', () => {
  const body = { site: 'https://m.edu', token: TOKEN, tz: 'Europe/Kyiv', syncKey: KEY };
  it('accepts a valid body', () => {
    expect(parseLinkStart(body)).toEqual({ ok: true, value: body });
  });
  it.each([
    [{ ...body, token: 'short' }, 'invalid_token'],
    [{ ...body, token: 'bad token with spaces!!' }, 'invalid_token'],
    [{ ...body, tz: 'Mars/Base' }, 'invalid_timezone'],
    [{ ...body, syncKey: 'tooshort' }, 'invalid_sync_key'],
    [{ ...body, site: 5 }, 'invalid_site'],
    [null, 'invalid_body'],
    [[], 'invalid_body'],
  ])('rejects %j', (input, error) => {
    expect(parseLinkStart(input)).toEqual({ ok: false, error });
  });
});

describe('parseSync', () => {
  it('accepts valid items and drops duplicate keys', () => {
    const result = parseSync({ items: [item(), item({ name: 'again' }), item({ key: 'forum-2' })] });
    expect(result.ok && result.value.map((t) => t.key)).toEqual(['assign-1', 'forum-2']);
  });
  it('trims and caps text, blanks unsafe links', () => {
    const result = parseSync({ items: [item({ name: `  ${'x'.repeat(500)}  `, url: 'javascript:alert(1)' })] });
    expect(result.ok && result.value[0].name.length).toBe(200);
    expect(result.ok && result.value[0].url).toBe('');
  });
  it('rejects the whole request on any bad item', () => {
    for (const bad of [{ due: 0 }, { due: 1.5 }, { due: 9e12 }, { key: '' }, { key: 'a b' }, { name: '' }, { done: 'yes' }, { submitted: 1 }]) {
      expect(parseSync({ items: [item(), item(bad)] })).toEqual({ ok: false, error: 'invalid_item' });
    }
  });
  it('rejects a non-array and too many items', () => {
    expect(parseSync({ items: 'x' }).ok).toBe(false);
    expect(parseSync({}).ok).toBe(false);
    expect(parseSync({ items: Array.from({ length: 301 }, (_, i) => item({ key: `k${i}` })) })).toEqual({ ok: false, error: 'too_many_items' });
  });
});
