import { describe, expect, it } from 'vitest';
import { kyiv } from '../lib/test-time';
import { createTracker } from './analytics-repo';

describe('createTracker (server events)', () => {
  it('records under the server visitor with the Kyiv day and hour', async () => {
    const calls: unknown[][] = [];
    const track = createTracker({ record: async (...args) => void calls.push(args) }, () => kyiv(27, 23, 30));
    await track('reminders_linked');
    await track('reminder_sent', 4);
    expect(calls).toEqual([['reminders_linked', 'server', 1, '2026-10-27', 23], ['reminder_sent', 'server', 4, '2026-10-27', 23]]);
  });

  it('skips zero counts and never throws', async () => {
    const calls: unknown[][] = [];
    await createTracker({ record: async (...a) => void calls.push(a) })('reminder_sent', 0);
    expect(calls).toEqual([]);
    await expect(createTracker({ record: async () => { throw new Error('d1 down'); } })('reminders_linked')).resolves.toBeUndefined();
  });
});
