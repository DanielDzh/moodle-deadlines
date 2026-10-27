import { describe, expect, it } from 'vitest';
import { kyiv } from '../lib/test-time';
import { sha256Hex } from '../lib/token-crypto';
import { handleHit } from './hit';

const ID = 'abcdefghijklmnopqrstuvwx';
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const setup = () => {
  const records: { event: string; visitor: string; n: number; day: string; hour: number }[] = [];
  const repo = { record: async (event: string, visitor: string, n: number, day: string, hour: number) => void records.push({ event, visitor, n, day, hour }) };
  const hit = (body: unknown, headers: Record<string, string> = { 'User-Agent': BROWSER }) =>
    handleHit(new Request('https://w.example/api/hit', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }), { repo, now: () => kyiv(27, 14, 30) });
  return { records, hit };
};

describe('POST /api/hit', () => {
  it('counts an event with the Kyiv day and hour and a hash of the id, never the id itself', async () => {
    const { records, hit } = setup();
    expect((await hit({ id: ID, event: 'visit' })).status).toBe(204);
    expect(records).toEqual([{ event: 'visit', visitor: (await sha256Hex(ID)).slice(0, 16), n: 1, day: '2026-10-27', hour: 14 }]);
    expect(JSON.stringify(records)).not.toContain(ID);
  });

  it.each(['visit', 'login', 'reminders_open', 'donate_click'])('accepts the site event %s', async (event) => {
    const { records, hit } = setup();
    await hit({ id: ID, event });
    expect(records).toHaveLength(1);
  });

  it('ignores server-only and unknown events without an error', async () => {
    const { records, hit } = setup();
    for (const event of ['reminder_sent', 'reminders_linked', 'drop table', 42]) expect((await hit({ id: ID, event })).status).toBe(204);
    expect(records).toEqual([]);
  });

  it('respects Do Not Track and Global Privacy Control', async () => {
    const { records, hit } = setup();
    expect((await hit({ id: ID, event: 'visit' }, { 'User-Agent': BROWSER, DNT: '1' })).status).toBe(204);
    expect((await hit({ id: ID, event: 'visit' }, { 'User-Agent': BROWSER, 'Sec-GPC': '1' })).status).toBe(204);
    expect(records).toEqual([]);
  });

  it('does not count crawlers, link previews, scripts or requests without a user agent', async () => {
    const { records, hit } = setup();
    for (const agent of ['Googlebot/2.1', 'facebookexternalhit/1.1', 'curl/8.4.0', 'Mozilla/5.0 HeadlessChrome/120', 'python-requests/2.31', '']) {
      await hit({ id: ID, event: 'visit' }, agent ? { 'User-Agent': agent } : {});
    }
    expect(records).toEqual([]);
  });

  it('rejects malformed bodies and ids', async () => {
    const { records, hit } = setup();
    expect((await hit('not json')).status).toBe(400);
    expect((await hit({ id: 'short', event: 'visit' })).status).toBe(400);
    expect((await hit({ id: 'has spaces and symbols !!!!', event: 'visit' })).status).toBe(400);
    expect((await hit({ event: 'visit' })).status).toBe(400);
    expect(records).toEqual([]);
  });

  it('never fails the page because storage failed', async () => {
    const response = await handleHit(new Request('https://w.example/api/hit', { method: 'POST', headers: { 'User-Agent': BROWSER }, body: JSON.stringify({ id: ID, event: 'visit' }) }), { repo: { record: async () => { throw new Error('d1 down'); } } });
    expect(response.status).toBe(204);
  });
});
