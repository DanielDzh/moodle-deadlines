// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statsDisabled, track } from './analytics';

const setNavigator = (props: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(props)) Object.defineProperty(navigator, key, { value, configurable: true });
};

describe('analytics', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    setNavigator({ doNotTrack: null, globalPrivacyControl: undefined });
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the event with a random anonymous id and no credentials or referrer', () => {
    track('visit');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/hit$/);
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain');
    const body = JSON.parse(String(init.body));
    expect(body.event).toBe('visit');
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
  });

  it('keeps the same id between events and across reloads', () => {
    track('visit');
    track('login');
    const ids = fetchMock.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)).id);
    expect(ids[0]).toBe(ids[1]);
    expect(JSON.parse(localStorage.getItem('md.vid')!)).toBe(ids[0]);
  });

  it('sends nothing when Do Not Track, Global Privacy Control or the opt-out switch is on', () => {
    setNavigator({ doNotTrack: '1' });
    track('visit');
    setNavigator({ doNotTrack: null, globalPrivacyControl: true });
    track('visit');
    setNavigator({ globalPrivacyControl: undefined });
    localStorage.setItem('md.noStats', 'true');
    track('visit');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(statsDisabled()).toBe(true);
  });

  it('never throws or surfaces an error when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(() => track('donate_click')).not.toThrow();
    await Promise.resolve();
    vi.stubGlobal('fetch', () => { throw new Error('blocked'); });
    expect(() => track('login')).not.toThrow();
  });

  it('does not create an id when statistics are off', () => {
    localStorage.setItem('md.noStats', 'true');
    track('visit');
    expect(localStorage.getItem('md.vid')).toBeNull();
  });
});
