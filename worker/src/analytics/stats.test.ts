import { describe, expect, it } from 'vitest';
import { kyiv } from '../lib/test-time';
import type { StatsRepo } from '../types';
import { buildStats } from './stats';

const NOW = kyiv(27, 14, 0); // Kyiv day 2026-10-27

/** A fake reader that records the windows it was asked for. */
const repoWith = (over: Partial<StatsRepo> = {}) => {
  const asked: Record<string, string[]> = {};
  const note = (name: string, day: string) => (asked[name] ??= []).push(day);
  const repo: StatsRepo = {
    uniqueVisitorsSince: async (d) => (note('unique', d), { '2026-10-27': 4, '2026-10-25': 9, '2026-10-21': 15, '2026-09-28': 40 }[d] ?? 0),
    perDay: async (d) => (note('perDay', d), [{ day: '2026-10-27', visitors: 4, visits: 7, logins: 2 }, { day: '2026-10-25', visitors: 5, visits: 6, logins: 1 }]),
    visitsByHour: async () => [{ hour: 9, visits: 3 }, { hour: 22, visits: 8 }],
    eventTotals: async (d) => (note('events', d), d === '2026-10-27' ? [{ event: 'visit', total: 7, people: 4 }] : [{ event: 'visit', total: 90, people: 40 }, { event: 'donate_click', total: 5, people: 3 }, { event: 'reminder_sent', total: 21, people: 0 }]),
    newAndReturning: async (d) => (note('newRet', d), { newVisitors: 6, returning: 9 }),
    activeDaysHistogram: async () => [{ days: 1, visitors: 20 }, { days: 2, visitors: 8 }, { days: 3, visitors: 5 }, { days: 5, visitors: 3 }, { days: 6, visitors: 2 }, { days: 12, visitors: 2 }],
    ...over,
  };
  return { repo, asked };
};

describe('buildStats', () => {
  it('asks for today, 3, 7 and 30 days counted back from the Kyiv day, today included', async () => {
    const { repo, asked } = repoWith();
    await buildStats(repo, NOW);
    expect(asked.unique).toEqual(['2026-10-27', '2026-10-25', '2026-10-21', '2026-09-28']);
    expect(asked.newRet).toEqual(['2026-10-21']);
    expect(asked.events).toEqual(['2026-10-27', '2026-09-28']);
  });

  it('reports unique visitors per window', async () => {
    const stats = await buildStats(repoWith().repo, NOW);
    expect(stats.visitors).toEqual({ today: 4, last3: 9, last7: 15, last30: 40 });
    expect(stats.today).toBe('2026-10-27');
  });

  it('fills a full 30-day series with zeros for quiet days', async () => {
    const stats = await buildStats(repoWith().repo, NOW);
    expect(stats.perDay).toHaveLength(30);
    expect(stats.perDay[0].day).toBe('2026-09-28');
    expect(stats.perDay[29]).toEqual({ day: '2026-10-27', visitors: 4, visits: 7, logins: 2 });
    expect(stats.perDay.find((d) => d.day === '2026-10-26')).toEqual({ day: '2026-10-26', visitors: 0, visits: 0, logins: 0 });
  });

  it('gives 24 hourly buckets', async () => {
    const { byHour } = await buildStats(repoWith().repo, NOW);
    expect(byHour).toHaveLength(24);
    expect(byHour[9]).toBe(3);
    expect(byHour[22]).toBe(8);
    expect(byHour[3]).toBe(0);
  });

  it('groups how often people come: once, twice, 3-5 days, 6+ days', async () => {
    const stats = await buildStats(repoWith().repo, NOW);
    expect(stats.frequency30).toEqual({ once: 20, twice: 8, threeToFive: 8, sixPlus: 4 });
  });

  it('computes the donate click rate from unique people', async () => {
    const stats = await buildStats(repoWith().repo, NOW);
    expect(stats.donate).toEqual({ clickers30: 3, rate30: 7.5 });
    expect(stats.events.last30.reminder_sent).toBe(21);
    expect(stats.people30.donate_click).toBe(3);
    expect(stats.newVsReturning7).toEqual({ newVisitors: 6, returning: 9 });
  });

  it('has no division by zero when nobody visited', async () => {
    const empty = repoWith({ uniqueVisitorsSince: async () => 0, eventTotals: async () => [], activeDaysHistogram: async () => [], perDay: async () => [] });
    const stats = await buildStats(empty.repo, NOW);
    expect(stats.donate).toEqual({ clickers30: 0, rate30: 0 });
    expect(stats.frequency30).toEqual({ once: 0, twice: 0, threeToFive: 0, sixPlus: 0 });
  });
});
