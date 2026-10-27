import { describe, expect, it } from 'vitest';
import { bucketFor, clientAddress, enforceLimit } from './rate-limit';

const NOW = 1_800_000_000 - (1_800_000_000 % 3600) + 600; // 10 minutes into an hour
const req = (ip?: string) => new Request('https://w.example/api/link/start', { method: 'POST', headers: ip ? { 'CF-Connecting-IP': ip } : {} });

const counter = () => {
  const counts = new Map<string, number>();
  return {
    counts,
    repo: { hit: async (bucket: string, window: number) => { const key = `${bucket}@${window}`; counts.set(key, (counts.get(key) ?? 0) + 1); return counts.get(key)!; } },
  };
};
const opts = (over: Partial<{ secret: string; route: string; limit: number; now: number }> = {}) => ({ secret: 's3cret', route: 'link-start', limit: 3, now: NOW, ...over });

describe('enforceLimit', () => {
  it('lets requests through up to the limit, then blocks with the time left in the hour', async () => {
    const { repo } = counter();
    for (let i = 0; i < 3; i++) expect(await enforceLimit(repo, req('1.2.3.4'), opts())).toBeNull();
    expect(await enforceLimit(repo, req('1.2.3.4'), opts())).toEqual({ limited: true, retryAfter: 3000 });
  });

  it('counts every address separately', async () => {
    const { repo } = counter();
    for (let i = 0; i < 4; i++) await enforceLimit(repo, req('1.2.3.4'), opts());
    expect(await enforceLimit(repo, req('5.6.7.8'), opts())).toBeNull();
  });

  it('counts every route separately and starts again in the next hour', async () => {
    const { repo } = counter();
    for (let i = 0; i < 4; i++) await enforceLimit(repo, req('1.2.3.4'), opts());
    expect(await enforceLimit(repo, req('1.2.3.4'), opts({ route: 'hit' }))).toBeNull();
    expect(await enforceLimit(repo, req('1.2.3.4'), opts({ now: NOW + 3600 }))).toBeNull();
  });

  it('does nothing without a client address (local development)', async () => {
    const { repo, counts } = counter();
    expect(await enforceLimit(repo, req(), opts({ limit: 0 }))).toBeNull();
    expect(counts.size).toBe(0);
  });

  it('fails open when the counter cannot be written', async () => {
    const broken = { hit: async () => { throw new Error('d1 down'); } };
    expect(await enforceLimit(broken, req('1.2.3.4'), opts({ limit: 0 }))).toBeNull();
  });
});

describe('bucketFor', () => {
  it('never contains the address and differs by secret, route, address and hour', async () => {
    const a = await bucketFor('s', 'r', '1.2.3.4', 100);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toContain('1.2.3.4');
    const others = await Promise.all([bucketFor('x', 'r', '1.2.3.4', 100), bucketFor('s', 'q', '1.2.3.4', 100), bucketFor('s', 'r', '1.2.3.5', 100), bucketFor('s', 'r', '1.2.3.4', 3700)]);
    expect(new Set([a, ...others]).size).toBe(5);
  });

  it('reads the address Cloudflare reports', () => {
    expect(clientAddress(req('9.9.9.9'))).toBe('9.9.9.9');
    expect(clientAddress(req())).toBeNull();
  });
});
