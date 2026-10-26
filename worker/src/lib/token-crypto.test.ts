import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, generateTokenKey, sha256Hex } from './token-crypto';

const TOKEN = 'f3a1c9d2e4b5a6978877665544332211';

describe('Moodle token encryption', () => {
  it('decrypts what it encrypted', async () => {
    const key = generateTokenKey();
    const payload = await encryptToken(TOKEN, key, 'user-1');
    expect(payload.startsWith('v1.')).toBe(true);
    expect(payload).not.toContain(TOKEN);
    expect(await decryptToken(payload, key, 'user-1')).toBe(TOKEN);
  });

  it('gives a different ciphertext every time (unique iv)', async () => {
    const key = generateTokenKey();
    const a = await encryptToken(TOKEN, key, 'user-1');
    const b = await encryptToken(TOKEN, key, 'user-1');
    expect(a).not.toBe(b);
  });

  it('does not decrypt with another key', async () => {
    const payload = await encryptToken(TOKEN, generateTokenKey(), 'user-1');
    await expect(decryptToken(payload, generateTokenKey(), 'user-1')).rejects.toThrow();
  });

  it('does not decrypt under another user (AAD)', async () => {
    const key = generateTokenKey();
    const payload = await encryptToken(TOKEN, key, 'user-1');
    await expect(decryptToken(payload, key, 'user-2')).rejects.toThrow();
  });

  it('detects tampering', async () => {
    const key = generateTokenKey();
    const [v, iv, cipher] = (await encryptToken(TOKEN, key, 'user-1')).split('.');
    const flipped = cipher.slice(0, 2) === 'AA' ? 'BB' + cipher.slice(2) : 'AA' + cipher.slice(2);
    await expect(decryptToken(`${v}.${iv}.${flipped}`, key, 'user-1')).rejects.toThrow();
  });

  it('rejects an unknown format and a bad key', async () => {
    const key = generateTokenKey();
    await expect(decryptToken('v9.abc.def', key, 'u')).rejects.toThrow(/format/);
    await expect(decryptToken('nonsense', key, 'u')).rejects.toThrow();
    await expect(encryptToken(TOKEN, btoa('short'), 'u')).rejects.toThrow(/32 bytes/);
  });

  it('the sync key is hashed to hex SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
