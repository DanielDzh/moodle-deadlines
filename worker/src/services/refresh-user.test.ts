import { describe, expect, it } from 'vitest';
import { TEXTS } from '../bot/texts';
import { generateTokenKey, encryptToken } from '../lib/token-crypto';
import type { Collected } from '../moodle/collect-tasks';
import { MoodleApiError, type MoodleCall } from '../moodle/moodle-client';
import { refreshNextUser, type RefreshDeps, type RefreshRepo, type RefreshTarget } from './refresh-user';

const NOW = 1_800_000_000;
const TOKEN = 'f3a1c9d2e4b5a6978877665544332211';

const setup = async (over: Partial<RefreshTarget> = {}, makeCall?: RefreshDeps['makeCall'], target: boolean = true) => {
  const tokenKey = generateTokenKey();
  const base: RefreshTarget = { id: 'u1', site: 'https://m.edu', tokenEnc: await encryptToken(TOKEN, tokenKey, 'u1'), chatId: 111, ...over };
  const saved: { id: string; collected: Collected }[] = [];
  const failed: string[] = [];
  const paused: string[] = [];
  const messages: { chatId: number; text: string }[] = [];
  const tokensUsed: string[] = [];
  const repo: RefreshRepo = {
    nextTarget: async () => (target ? base : null),
    saveTasks: async (id, collected) => void saved.push({ id, collected }),
    markFailed: async (id) => void failed.push(id),
    pause: async (id) => void paused.push(id),
  };
  const deps: RefreshDeps = {
    repo,
    tokenKey,
    blockedSites: ['blocked.org'],
    telegram: { sendMessage: async (chatId, text) => (messages.push({ chatId, text }), { ok: true }) },
    makeCall: makeCall ?? ((_site, token) => ((tokensUsed.push(token), emptyMoodle()) as MoodleCall)),
  };
  return { deps, saved, failed, paused, messages, tokensUsed };
};

const emptyMoodle = (): MoodleCall => (async () => ({ courses: [] })) as MoodleCall;
const throwing = (code: string) => (() => (async () => { throw new MoodleApiError(code); }) as MoodleCall);

describe('refreshNextUser', () => {
  it('does nothing when no user is due', async () => {
    const s = await setup({}, undefined, false);
    expect(await refreshNextUser(s.deps, NOW)).toBe('none');
  });

  it('decrypts the token, fetches and saves the tasks', async () => {
    const s = await setup();
    expect(await refreshNextUser(s.deps, NOW)).toBe('refreshed');
    expect(s.tokensUsed).toEqual([TOKEN]);
    expect(s.saved).toEqual([{ id: 'u1', collected: { tasks: [], complete: true } }]);
    expect(s.failed).toEqual([]);
  });

  it('an expired token pauses the user, drops the token and tells them once', async () => {
    const s = await setup({}, throwing('invalidtoken'));
    expect(await refreshNextUser(s.deps, NOW)).toBe('auth_expired');
    expect(s.paused).toEqual(['u1']);
    expect(s.messages).toEqual([{ chatId: 111, text: TEXTS.authExpired }]);
    expect(s.saved).toEqual([]);
  });

  it('a temporary Moodle failure only backs off', async () => {
    const s = await setup({}, throwing('network'));
    expect(await refreshNextUser(s.deps, NOW)).toBe('failed');
    expect(s.failed).toEqual(['u1']);
    expect(s.paused).toEqual([]);
    expect(s.messages).toEqual([]);
  });

  it('refuses a site that is no longer acceptable, without contacting it', async () => {
    for (const site of ['http://m.edu', 'https://10.0.0.5', 'https://x.blocked.org']) {
      const s = await setup({ site });
      expect(await refreshNextUser(s.deps, NOW)).toBe('paused');
      expect(s.paused).toEqual(['u1']);
      expect(s.tokensUsed).toEqual([]);
    }
  });

  it('pauses when the stored token cannot be decrypted (wrong key or user)', async () => {
    const s = await setup({ tokenEnc: await encryptToken(TOKEN, generateTokenKey(), 'u1') });
    expect(await refreshNextUser(s.deps, NOW)).toBe('paused');
    expect(s.tokensUsed).toEqual([]);
  });

  it('does not message a user who has no chat when the token expires', async () => {
    const s = await setup({ chatId: null }, throwing('accessexception'));
    expect(await refreshNextUser(s.deps, NOW)).toBe('auth_expired');
    expect(s.messages).toEqual([]);
  });
});
