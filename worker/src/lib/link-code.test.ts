import { describe, expect, it } from 'vitest';
import { PATTERNS } from '../config';
import { generateLinkCode, generateUserId } from './link-code';

describe('link codes', () => {
  it('are 10 unambiguous characters the bot accepts', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLinkCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    }
  });

  it('do not repeat', () => {
    const codes = new Set(Array.from({ length: 500 }, generateLinkCode));
    expect(codes.size).toBe(500);
  });

  it('user ids are uuids', () => {
    expect(generateUserId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(PATTERNS.syncKey.test('x'.repeat(32))).toBe(true);
  });
});
