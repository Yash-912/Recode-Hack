// ─── Rate Limiter — Token Bucket (Redis) ───────────────────
// Max 100 req/s per site_id for /api/collect

import { redis } from './redis';

const MAX_REQUESTS = 100;
const WINDOW_SECONDS = 1;

export async function checkRateLimit(siteId: string): Promise<boolean> {
  const key = `rl:${siteId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return count <= MAX_REQUESTS; // true = allowed, false = rate limited
}
