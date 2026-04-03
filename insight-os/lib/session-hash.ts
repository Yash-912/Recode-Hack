// ─── Session Hash Utility ──────────────────────────────────
// Privacy-first session identity: SHA256(IP + UA + YYYY-MM-DD)
// No PII stored. One-way hash — cannot reverse to get IP.

import { createHash } from 'crypto';

export function computeSessionHash(ip: string, userAgent: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash('sha256')
    .update(`${ip}${userAgent}${today}`)
    .digest('hex');
}
