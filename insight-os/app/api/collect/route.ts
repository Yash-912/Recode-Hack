import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { detectBot } from '@/lib/bot-detection';
import { lookupGeoIP } from '@/lib/geo-ip';
import { computeSessionHash } from '@/lib/session-hash';
import { checkRateLimit } from '@/lib/rate-limiter';
import { redis } from '@/lib/redis';

const payloadSchema = z.object({
  site_id: z.string().min(1),
  type: z.enum(['pageview', 'click']),
  url: z.string().optional(),
  referrer: z.string().nullable().optional(),
  x_pct: z.number().nullable().optional(),
  y_pct: z.number().nullable().optional(),
  screen_w: z.number().optional(),
  screen_h: z.number().optional(),
  is_bot_honeypot: z.boolean().optional(),
  ts: z.number(),
}).passthrough();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    if (!rawBody) return new NextResponse(null, { status: 204, headers: corsHeaders });

    const data = JSON.parse(rawBody);
    const parsed = payloadSchema.safeParse(data);

    if (!parsed.success) {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    const payload = parsed.data;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const ua = req.headers.get('user-agent') || 'unknown';

    // ─── 2B.8 Rate Limit check ───────────────────────────
    const rateLimitOk = await checkRateLimit(payload.site_id);
    if (!rateLimitOk) {
      return new NextResponse(null, { status: 429, headers: corsHeaders });
    }

    const [botCheck, geoData] = await Promise.all([
      detectBot(ua, ip, payload.referrer || ''),
      lookupGeoIP(ip)
    ]);

    const sessionHash = computeSessionHash(ip, ua);

    // ─── 1B.4 Dual-Write Pipeline ────────────────────────
    // We run the raw insert and the upsert in a high-perf transaction
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0); // truncate to hour

    // Determine increments
    const isPageview = payload.type === 'pageview' ? 1 : 0;
    const isClick = payload.type === 'click' ? 1 : 0;

    // ─── 2B.5 Read-Modify-Write JSONB Stats ──────────────
    const existingStat = await prisma.hourlyStat.findUnique({
      where: { siteId_hour: { siteId: payload.site_id, hour: currentHour } }
    });

    const updateTopList = (jsonStr: any, key: string, targetValue: string) => {
      let arr: any[] = [];
      try { arr = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || []); } catch (e) {}
      const existing = arr.find((x: any) => x[key] === targetValue);
      if (existing) existing.count += 1;
      else arr.push({ [key]: targetValue, count: 1 });
      return arr.sort((a, b) => b.count - a.count).slice(0, 5);
    };

    let topP = existingStat?.topPages || [];
    let topR = existingStat?.topReferrers || [];
    let topC = existingStat?.topCountries || [];

    if (!botCheck.isBot) {
      if (payload.url && isPageview) topP = updateTopList(topP, 'url', payload.url);
      if (payload.referrer) topR = updateTopList(topR, 'referrer', payload.referrer);
      if (geoData?.country) topC = updateTopList(topC, 'country', geoData.country);
    }

    // ─── 2A.8 Push to Redis FIRST (instant SSE visibility) ───
    // Redis is ~5ms vs Neon DB which is 500ms-2s from India.
    // Push the live event to Redis immediately so the SSE feed 
    // shows it while the DB write happens in background.
    if (!botCheck.isBot) {
      const liveEvent = {
        id: Date.now().toString(),
        type: payload.type,
        url: payload.url || '/',
        country: geoData?.country || 'Unknown',
        ts: new Date().toISOString()
      };
      await redis.lpush(`live:${payload.site_id}`, JSON.stringify(liveEvent));
      await redis.ltrim(`live:${payload.site_id}`, 0, 49);
    }

    // ─── DB Write (slower, but runs after Redis) ────────────
    // Prisma Transaction ensures O(hours) dashboard performance
    await prisma.$transaction([
      // 1. Append to raw Events table
      prisma.event.create({
        data: {
          siteId: payload.site_id,
          type: payload.type,
          url: payload.url || null,
          referrer: payload.referrer || null,
          xPct: payload.x_pct || null,
          yPct: payload.y_pct || null,
          country: geoData?.country || null,
          sessionHash: sessionHash,
          uaRaw: ua,
          isBot: botCheck.isBot || (payload.is_bot_honeypot === true),
          isBotHoneypot: payload.is_bot_honeypot || false,
        }
      }),

      // 2. Pre-aggregate into HourlyStat table (only if not a bot)
      ...(botCheck.isBot ? [] : [
        prisma.hourlyStat.upsert({
          where: {
            siteId_hour: { siteId: payload.site_id, hour: currentHour }
          },
          update: {
            pageviews: { increment: isPageview },
            clicks: { increment: isClick },
            topPages: topP as any,
            topReferrers: topR as any,
            topCountries: topC as any,
          },
          create: {
            siteId: payload.site_id,
            hour: currentHour,
            pageviews: isPageview,
            clicks: isClick,
            topPages: topP as any,
            topReferrers: topR as any,
            topCountries: topC as any,
          }
        })
      ])
    ]);

    // return 204 instantly so sendBeacon closes
    return new NextResponse(null, { status: 204, headers: corsHeaders });

  } catch (error) {
    console.error('[Collector] Error:', error);
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }
}
