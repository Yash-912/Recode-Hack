// ─── Upstash Redis Client ──────────────────────────────────
// Used for: Live Feed pub/sub, bot velocity checks, rate limiting

import { Redis } from '@upstash/redis';

if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
  throw new Error('Missing REDIS_URL or REDIS_TOKEN env variables');
}

export const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});
