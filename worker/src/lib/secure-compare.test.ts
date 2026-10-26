import { describe, expect, it } from 'vitest';
import { secretsMatch } from './secure-compare';

describe('secretsMatch', () => {
  it('accepts equal secrets and rejects different ones, whatever their length', async () => {
    expect(await secretsMatch('s3cret-value', 's3cret-value')).toBe(true);
    expect(await secretsMatch('s3cret-value', 's3cret-valuf')).toBe(false);
    expect(await secretsMatch('short', 'a much longer secret')).toBe(false);
    expect(await secretsMatch('', 'x')).toBe(false);
  });
});
