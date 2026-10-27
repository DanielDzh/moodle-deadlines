import { ANALYTICS } from '../config';
import { localDayHour, shiftDay } from '../lib/local-time';
import type { StatsRepo } from '../types';

export interface Stats {
  generatedAt: number;
  timeZone: string;
  today: string;
  visitors: { today: number; last3: number; last7: number; last30: number };
  perDay: { day: string; visitors: number; visits: number; logins: number }[];
  byHour: number[];
  events: { today: Record<string, number>; last30: Record<string, number> };
  /** Unique people in the last 30 days who did the event at least once (server events have no people). */
  people30: Record<string, number>;
  newVsReturning7: { newVisitors: number; returning: number };
  /** How many different days each visitor came on, last 30 days: 1, 2, 3-5, 6+. */
  frequency30: { once: number; twice: number; threeToFive: number; sixPlus: number };
  donate: { clickers30: number; rate30: number };
}

const toMap = (rows: { event: string; total: number }[]): Record<string, number> => Object.fromEntries(rows.map((r) => [r.event, r.total]));

/** Everything the owner's statistics page shows, computed from anonymous counters. */
export const buildStats = async (repo: StatsRepo, nowSec: number): Promise<Stats> => {
  const { day: today } = localDayHour(nowSec, ANALYTICS.timeZone);
  const since = { d3: shiftDay(today, -2), d7: shiftDay(today, -6), d30: shiftDay(today, -29) };

  const [todayUnique, unique3, unique7, unique30, perDayRows, hourRows, eventsToday, events30, newRet, histogram] = await Promise.all([
    repo.uniqueVisitorsSince(today), repo.uniqueVisitorsSince(since.d3), repo.uniqueVisitorsSince(since.d7), repo.uniqueVisitorsSince(since.d30),
    repo.perDay(since.d30), repo.visitsByHour(since.d30), repo.eventTotals(today), repo.eventTotals(since.d30),
    repo.newAndReturning(since.d7), repo.activeDaysHistogram(since.d30),
  ]);

  const byDay = new Map(perDayRows.map((r) => [r.day, r]));
  const perDay = Array.from({ length: 30 }, (_, i) => {
    const day = shiftDay(since.d30, i);
    return byDay.get(day) ?? { day, visitors: 0, visits: 0, logins: 0 };
  });

  const byHour = Array.from({ length: 24 }, (_, h) => hourRows.find((r) => r.hour === h)?.visits ?? 0);

  const days = (from: number, to: number) => histogram.filter((h) => h.days >= from && h.days <= to).reduce((sum, h) => sum + h.visitors, 0);
  const clickers30 = events30.find((e) => e.event === 'donate_click')?.people ?? 0;

  return {
    generatedAt: nowSec,
    timeZone: ANALYTICS.timeZone,
    today,
    visitors: { today: todayUnique, last3: unique3, last7: unique7, last30: unique30 },
    perDay,
    byHour,
    events: { today: toMap(eventsToday), last30: toMap(events30) },
    people30: Object.fromEntries(events30.map((e) => [e.event, e.people])),
    newVsReturning7: newRet,
    frequency30: { once: days(1, 1), twice: days(2, 2), threeToFive: days(3, 5), sixPlus: days(6, Infinity) },
    donate: { clickers30, rate30: unique30 ? Math.round((clickers30 / unique30) * 1000) / 10 : 0 },
  };
};
