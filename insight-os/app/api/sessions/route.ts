import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('site_id');

  if (!siteId) {
    return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
  }

  try {
    // Fetch the most recent 500 events (non-bot, with session hashes)
    const events = await prisma.event.findMany({
      where: { siteId, isBot: false, sessionHash: { not: null } },
      orderBy: { ts: 'desc' },
      take: 500,
      select: {
        type: true,
        url: true,
        xPct: true,
        yPct: true,
        country: true,
        uaRaw: true,
        sessionHash: true,
        ts: true,
      }
    });

    // Group by sessionHash
    const sessionMap = new Map<string, typeof events>();
    for (const ev of events) {
      const key = ev.sessionHash!;
      if (!sessionMap.has(key)) sessionMap.set(key, []);
      sessionMap.get(key)!.push(ev);
    }

    // Build session summaries
    const sessions = Array.from(sessionMap.entries()).map(([hash, evts]) => {
      const sorted = evts.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      const pageviews = sorted.filter(e => e.type === 'pageview');
      const clicks = sorted.filter(e => e.type === 'click');
      const ua = sorted[0].uaRaw || '';
      const isMobile = /mobile|android|iphone|ipad/i.test(ua);
      const lastPage = pageviews[pageviews.length - 1]?.url || sorted[sorted.length - 1]?.url || '/';
      const didConvert = lastPage?.includes('thank') || lastPage?.includes('success') || lastPage?.includes('confirm') || false;

      return {
        sessionHash: hash,
        device: isMobile ? 'mobile' : 'desktop',
        country: sorted[0].country || 'Unknown',
        totalEvents: sorted.length,
        pageviews: pageviews.length,
        clicks: clicks.length,
        firstEvent: sorted[0].ts,
        lastEvent: sorted[sorted.length - 1].ts,
        lastPage,
        converted: didConvert,
        pages: [...new Set(pageviews.map(e => e.url))],
      };
    });

    // Sort by most recent first, limit to 20
    sessions.sort((a, b) => new Date(b.firstEvent).getTime() - new Date(a.firstEvent).getTime());

    // 3A.6 — Find the "most interesting" session: longest that dropped at final funnel step
    const mostInteresting = sessions
      .filter(s => !s.converted && s.totalEvents >= 3)
      .sort((a, b) => b.totalEvents - a.totalEvents)[0] || null;

    return NextResponse.json({
      sessions: sessions.slice(0, 20),
      mostInteresting: mostInteresting?.sessionHash || null,
      total: sessions.length,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
