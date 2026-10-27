import { ANALYTICS } from '../config';
import { localDayHour } from '../lib/local-time';
import type { AnalyticsRepo, ServerEvent, StatsRepo, Tracker } from '../types';

/** D1 implementation of the statistics writer. */
export const createAnalyticsRepo = (db: D1Database): AnalyticsRepo => ({
  record: async (event, visitor, n, day, hour) => {
    await db
      .prepare(
        `INSERT INTO analytics_events (day, hour, visitor, event, n) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (day, hour, visitor, event) DO UPDATE SET n = n + excluded.n`,
      )
      .bind(day, hour, visitor, event, n)
      .run();
  },
});

/** A tracker for events the server counts itself. Swallows errors by design. */
export const createTracker = (repo: AnalyticsRepo, clock: () => number = () => Math.floor(Date.now() / 1000)): Tracker =>
  async (event: ServerEvent, n = 1) => {
    if (n <= 0) return;
    try {
      const { day, hour } = localDayHour(clock(), ANALYTICS.timeZone);
      await repo.record(event, ANALYTICS.serverVisitor, n, day, hour);
    } catch {
      /* statistics are best effort */
    }
  };

/** D1 implementation of the statistics reader. */
export const createStatsRepo = (db: D1Database): StatsRepo => ({
  uniqueVisitorsSince: async (day) => {
    const row = await db
      .prepare("SELECT COUNT(DISTINCT visitor) AS n FROM analytics_events WHERE event = 'visit' AND day >= ?1")
      .bind(day)
      .first<{ n: number }>();
    return row?.n ?? 0;
  },

  perDay: async (since) => {
    const rows = await db
      .prepare(
        `SELECT day,
                COUNT(DISTINCT CASE WHEN event = 'visit' THEN visitor END) AS visitors,
                COALESCE(SUM(CASE WHEN event = 'visit' THEN n END), 0) AS visits,
                COALESCE(SUM(CASE WHEN event = 'login' THEN n END), 0) AS logins
         FROM analytics_events WHERE day >= ?1 GROUP BY day ORDER BY day`,
      )
      .bind(since)
      .all<{ day: string; visitors: number; visits: number; logins: number }>();
    return rows.results;
  },

  visitsByHour: async (since) => {
    const rows = await db
      .prepare("SELECT hour, SUM(n) AS visits FROM analytics_events WHERE event = 'visit' AND day >= ?1 GROUP BY hour")
      .bind(since)
      .all<{ hour: number; visits: number }>();
    return rows.results;
  },

  eventTotals: async (since) => {
    const rows = await db
      .prepare(
        `SELECT event, SUM(n) AS total, COUNT(DISTINCT CASE WHEN visitor != ?2 THEN visitor END) AS people
         FROM analytics_events WHERE day >= ?1 GROUP BY event`,
      )
      .bind(since, ANALYTICS.serverVisitor)
      .all<{ event: string; total: number; people: number }>();
    return rows.results;
  },

  newAndReturning: async (since) => {
    const row = await db
      .prepare(
        `SELECT COALESCE(SUM(first_day >= ?1), 0) AS new_visitors, COALESCE(SUM(first_day < ?1), 0) AS returning_visitors
         FROM (SELECT MIN(day) AS first_day, MAX(day) AS last_day FROM analytics_events WHERE event = 'visit' GROUP BY visitor)
         WHERE last_day >= ?1`,
      )
      .bind(since)
      .first<{ new_visitors: number; returning_visitors: number }>();
    return { newVisitors: row?.new_visitors ?? 0, returning: row?.returning_visitors ?? 0 };
  },

  activeDaysHistogram: async (since) => {
    const rows = await db
      .prepare(
        `SELECT days, COUNT(*) AS visitors
         FROM (SELECT COUNT(DISTINCT day) AS days FROM analytics_events WHERE event = 'visit' AND day >= ?1 GROUP BY visitor)
         GROUP BY days ORDER BY days`,
      )
      .bind(since)
      .all<{ days: number; visitors: number }>();
    return rows.results;
  },
});
