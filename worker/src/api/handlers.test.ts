import { describe, expect, it } from 'vitest';
import { decryptToken, generateTokenKey, sha256Hex } from '../lib/token-crypto';
import type { ApiRepo, NewPendingUser, SyncTask } from '../types';
import { handleApi } from './handlers';

const NOW = 1_800_000_000;
const KEY = 'k'.repeat(40);
const TOKEN = 'f3a1c9d2e4b5a6978877665544332211';

/** In-memory storage that follows the D1 rules closely enough for these tests. */
const memory = () => {
  const users = new Map<string, NewPendingUser & { status: string }>();
  const tasks = new Map<string, SyncTask[]>();
  const repo: ApiRepo = {
    deleteExpiredPending: async (now) => {
      for (const [id, u] of users) if (u.status === 'pending' && u.expires < now) users.delete(id);
    },
    pendingCount: async () => [...users.values()].filter((u) => u.status === 'pending').length,
    createPending: async (u) => void users.set(u.id, { ...u, status: 'pending' }),
    findBySyncKeyHash: async (hash) => {
      const found = [...users.values()].filter((u) => u.syncKeyHash === hash).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'))[0];
      return found ? { id: found.id, status: found.status } : null;
    },
    replaceTasks: async (id, list) => (tasks.set(id, [...list]), list.length),
    deleteUsersBySyncKey: async (hash) => {
      for (const [id, u] of users) if (u.syncKeyHash === hash) (users.delete(id), tasks.delete(id));
    },
    deletePendingBySyncKey: async (hash) => {
      for (const [id, u] of users) if (u.syncKeyHash === hash && u.status === 'pending') users.delete(id);
    },
  };
  return { repo, users, tasks };
};

const setup = () => {
  const store = memory();
  const tokenKey = generateTokenKey();
  const call = (method: string, path: string, body?: unknown, auth: string | null = KEY) =>
    handleApi(
      new Request(`https://w.example${path}`, {
        method,
        headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      { repo: store.repo, tokenKey, botUsername: 'my_bot', blockedSites: ['blocked.org'], now: () => NOW },
    );
  return { ...store, tokenKey, call };
};

const start = { site: 'https://m.edu/', token: TOKEN, tz: 'Europe/Kyiv', syncKey: KEY };
const item = { key: 'assign-1', name: 'Lab 3', course: 'DB', url: 'https://m.edu/x', due: NOW + 86_400, done: false, submitted: false };

describe('site API', () => {
  it('link/start stores an encrypted token, a hashed key and returns the bot link', async () => {
    const { call, users, tokenKey } = setup();
    const res = await call('POST', '/api/link/start', start, null);
    const data = (await res.json()) as { code: string; expiresAt: number; botUrl: string };
    expect(res.status).toBe(200);
    expect(data.botUrl).toBe(`https://t.me/my_bot?start=${data.code}`);
    expect(data.expiresAt).toBe(NOW + 600);

    const row = [...users.values()][0];
    expect(row.site).toBe('https://m.edu');
    expect(row.syncKeyHash).toBe(await sha256Hex(KEY));
    expect(JSON.stringify(row)).not.toContain(TOKEN);
    expect(JSON.stringify(row)).not.toContain(KEY);
    expect(await decryptToken(row.tokenEnc, tokenKey, row.id)).toBe(TOKEN);
  });

  it('link/start rejects bad input without storing anything', async () => {
    const { call, users } = setup();
    for (const bad of [{ ...start, site: 'http://m.edu' }, { ...start, site: 'https://10.0.0.1' }, { ...start, site: 'https://x.blocked.org' }, { ...start, token: 'x' }]) {
      expect((await call('POST', '/api/link/start', bad, null)).status).toBe(400);
    }
    expect((await call('POST', '/api/link/start', 'not json', null)).status).toBe(400);
    expect(users.size).toBe(0);
  });

  it('status follows the lifecycle: none, pending, active, paused', async () => {
    const { call, users } = setup();
    const state = async () => ((await (await call('GET', '/api/link/status')).json()) as { state: string }).state;
    expect(await state()).toBe('none');
    await call('POST', '/api/link/start', start, null);
    expect(await state()).toBe('pending');
    const row = [...users.values()][0];
    row.status = 'active';
    expect(await state()).toBe('active');
    row.status = 'paused_auth';
    expect(await state()).toBe('paused');
  });

  it('all key-protected routes refuse a missing or malformed key', async () => {
    const { call } = setup();
    for (const [method, path] of [['GET', '/api/link/status'], ['POST', '/api/sync'], ['POST', '/api/unlink']] as const) {
      const body = method === 'GET' ? undefined : {};
      expect((await call(method, path, body, null)).status).toBe(401);
      expect((await call(method, path, body, 'short')).status).toBe(401);
    }
  });

  it('sync works only for an active link', async () => {
    const { call, users, tasks } = setup();
    expect((await call('POST', '/api/sync', { items: [item] })).status).toBe(409);
    await call('POST', '/api/link/start', start, null);
    expect((await call('POST', '/api/sync', { items: [item] })).status).toBe(409);
    [...users.values()][0].status = 'active';
    const ok = await call('POST', '/api/sync', { items: [item] });
    expect(await ok.json()).toEqual({ ok: true, tracked: 1 });
    expect([...tasks.values()][0]).toHaveLength(1);
    expect((await call('POST', '/api/sync', { items: [{ ...item, due: 0 }] })).status).toBe(400);
  });

  it('unlink deletes everything and is idempotent', async () => {
    const { call, users, tasks } = setup();
    await call('POST', '/api/link/start', start, null);
    [...users.values()][0].status = 'active';
    await call('POST', '/api/sync', { items: [item] });
    expect(await (await call('POST', '/api/unlink')).json()).toEqual({ ok: true });
    expect(users.size).toBe(0);
    expect(tasks.size).toBe(0);
    expect((await call('POST', '/api/unlink')).status).toBe(200);
  });

  it('a new link attempt replaces the same browser\'s older unfinished one', async () => {
    const { call, users } = setup();
    await call('POST', '/api/link/start', start, null);
    await call('POST', '/api/link/start', start, null);
    await call('POST', '/api/link/start', start, null);
    expect(users.size).toBe(1);
  });

  it('unlink removes every record of the browser key, not just one', async () => {
    const { call, users, tasks } = setup();
    await call('POST', '/api/link/start', start, null);
    const [first] = [...users.values()];
    first.status = 'active';
    // A second record with the same key (an older unfinished attempt that survived).
    users.set('stray', { ...first, id: 'stray', status: 'pending' });
    tasks.set('stray', [{ key: 'x', name: 'n', course: '', url: '', due: NOW + 1, done: false, submitted: false }]);
    await call('POST', '/api/unlink');
    expect(users.size).toBe(0);
    expect(tasks.size).toBe(0);
  });

  it('unlink leaves other browsers alone', async () => {
    const { call, users } = setup();
    await call('POST', '/api/link/start', start, null);
    await call('POST', '/api/link/start', { ...start, syncKey: 'z'.repeat(40) }, null);
    await call('POST', '/api/unlink');
    expect(users.size).toBe(1);
    expect([...users.values()][0].syncKeyHash).toBe(await sha256Hex('z'.repeat(40)));
  });

  it('expired pending links are cleaned up and the pending cap protects the database', async () => {
    const { call, users } = setup();
    await call('POST', '/api/link/start', start, null);
    [...users.values()][0].expires = NOW - 1;
    await call('POST', '/api/link/start', { ...start, syncKey: 'z'.repeat(40) }, null);
    expect(users.size).toBe(1);
  });

  it('unknown routes are 404 and errors never leak details', async () => {
    const { call } = setup();
    expect((await call('GET', '/api/nope')).status).toBe(404);
    const broken = await handleApi(new Request('https://w.example/api/link/status', { headers: { Authorization: `Bearer ${KEY}` } }), {
      repo: { ...memory().repo, findBySyncKeyHash: async () => { throw new Error(`boom ${TOKEN}`); } },
      tokenKey: generateTokenKey(), botUsername: 'b', blockedSites: [], now: () => NOW,
    });
    expect(broken.status).toBe(500);
    expect(await broken.text()).not.toContain(TOKEN);
  });
});
