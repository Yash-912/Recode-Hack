// ─── Bot Detection — 3-Layer System ───────────────────────
// Layer 1: UA blocklist (200+ known bots)
// Layer 2: Velocity check via Redis (>10 events/10s)
// Layer 3: Referrer spam domain list
// Flagged events are stored (is_bot=true) but excluded from dashboard queries.

import { redis } from './redis';

// ─── Layer 1: User-Agent Blocklist ─────────────────────────
const BOT_UA_PATTERNS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'exabot', 'facebot', 'facebookexternalhit',
  'ia_archiver', 'alexacrawler', 'mj12bot', 'ahrefsbot', 'semrushbot',
  'dotbot', 'rogerbot', 'screaming frog', 'uptimerobot', 'pingdom',
  'applebot', 'twitterbot', 'linkedinbot', 'embedly', 'quora link',
  'showyoubot', 'outbrain', 'pinterestbot', 'slackbot', 'vkshare',
  'w3c_validator', 'redditbot', 'mediapartners', 'adsbot-google',
  'google-inspectiontool', 'petalbot', 'seznambot', 'bytespider',
  'crawl', 'spider', 'bot/', 'bot;', 'headless', 'phantom', 'selenium',
  'puppeteer', 'playwright', 'wget', 'curl/', 'python-requests',
  'go-http-client', 'java/', 'apache-httpclient', 'httpclient',
];

// ─── Layer 3: Referrer Spam Domains ────────────────────────
const SPAM_REFERRERS = [
  'semalt.com', 'buttons-for-website.com', 'darodar.com',
  'econom.co', 'ilovevitaly.com', 'priceg.com',
  'hulfingtonpost.com', 'bestwebsitesawards.com',
  'o-o-6-o-o.com', 'get-free-traffic-now.com',
  'free-social-buttons.com', 'event-tracking.com',
  'trafficmonetize.org', 'traffic2money.com',
  'success-seo.com', 'rankings-analytics.com',
  'theguardlan.com', 'social-buttons.com',
  'buy-cheap-online.info', 'site-auditor.online',
];

function checkUABot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((pattern) => lower.includes(pattern));
}

function checkReferrerSpam(referrer: string): boolean {
  if (!referrer) return false;
  const lower = referrer.toLowerCase();
  return SPAM_REFERRERS.some((domain) => lower.includes(domain));
}

async function checkVelocity(ip: string): Promise<boolean> {
  const key = `vel:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 10); // 10-second window
  }
  return count > 10;
}

export interface BotCheckResult {
  isBot: boolean;
  reason: string | null;
}

export async function detectBot(
  ua: string,
  ip: string,
  referrer: string
): Promise<BotCheckResult> {
  // Layer 1 — UA check
  if (checkUABot(ua)) {
    return { isBot: true, reason: 'ua_blocklist' };
  }

  // Layer 3 — Referrer spam (check before velocity to avoid spending Redis calls)
  if (checkReferrerSpam(referrer)) {
    return { isBot: true, reason: 'referrer_spam' };
  }

  // Layer 2 — Velocity check (Redis)
  const isFast = await checkVelocity(ip);
  if (isFast) {
    return { isBot: true, reason: 'velocity' };
  }

  return { isBot: false, reason: null };
}
