import type { RateLimitRepo } from '../types';

/** D1 implementation of the abuse counters. */
export const createRateLimitRepo = (db: D1Database): RateLimitRepo => ({
  hit: async (bucket, window) => {
    const row = await db
      .prepare(
        `INSERT INTO rate_limits (bucket, window, n) VALUES (?1, ?2, 1)
         ON CONFLICT (bucket, window) DO UPDATE SET n = n + 1
         RETURNING n`,
      )
      .bind(bucket, window)
      .first<{ n: number }>();
    return row?.n ?? 0;
  },
});
