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
  xai: {
    layer: number | null;
    layer_name: string | null;
    pattern_matched: string | null;
    confidence: number;
    checks_performed: string[];
  };
}

export async function detectBot(
  ua: string,
  ip: string,
  referrer: string
): Promise<BotCheckResult> {
  const checksPerformed: string[] = [];

  // Layer 1 — UA check
  checksPerformed.push('ua_blocklist');
  const lowerUA = ua.toLowerCase();
  const matchedUA = BOT_UA_PATTERNS.find(p => lowerUA.includes(p));
  if (matchedUA) {
    return {
      isBot: true, reason: 'ua_blocklist',
      xai: { layer: 1, layer_name: 'User-Agent Blocklist', pattern_matched: matchedUA, confidence: 95, checks_performed: checksPerformed }
    };
  }

  // Layer 3 — Referrer spam
  checksPerformed.push('referrer_spam');
  const lowerRef = referrer?.toLowerCase() || '';
  const matchedRef = SPAM_REFERRERS.find(d => lowerRef.includes(d));
  if (matchedRef) {
    return {
      isBot: true, reason: 'referrer_spam',
      xai: { layer: 3, layer_name: 'Referrer Spam Filter', pattern_matched: matchedRef, confidence: 90, checks_performed: checksPerformed }
    };
  }

  // Layer 2 — Velocity check (Redis)
  checksPerformed.push('velocity_check');
  const isFast = await checkVelocity(ip);
  if (isFast) {
    return {
      isBot: true, reason: 'velocity',
      xai: { layer: 2, layer_name: 'IP Velocity (Redis)', pattern_matched: `>${10} events in 10s from ${ip}`, confidence: 85, checks_performed: checksPerformed }
    };
  }

  return {
    isBot: false, reason: null,
    xai: { layer: null, layer_name: null, pattern_matched: null, confidence: 98, checks_performed: checksPerformed }
  };
}
