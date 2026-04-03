import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCountryCoords } from '@/lib/country-coords';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('site_id');

  if (!siteId) {
    return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
  }

  try {
    // 3B.4 — Get recent sessions with country data
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentEvents = await prisma.event.findMany({
      where: {
        siteId,
        ts: { gte: fiveMinAgo },
        isBot: false,
      },
      select: {
        sessionHash: true,
        country: true,
        url: true,
        ts: true,
      },
      orderBy: { ts: 'desc' },
      take: 100
    });

    // Deduplicate by sessionHash — one dot per session
    const sessionsMap = new Map<string, any>();
    for (const ev of recentEvents) {
      if (ev.sessionHash && !sessionsMap.has(ev.sessionHash)) {
        const country = ev.country || 'Unknown';
        const [lat, lon] = getCountryCoords(country);
        
        // Add slight random jitter so dots from same country don't stack
        const jitterLat = lat + (Math.random() - 0.5) * 4;
        const jitterLon = lon + (Math.random() - 0.5) * 4;

        sessionsMap.set(ev.sessionHash, {
          sessionHash: ev.sessionHash,
          country,
          lat: jitterLat,
          lon: jitterLon,
          url: ev.url,
          ts: ev.ts,
        });
      }
    }

    return NextResponse.json({ locations: Array.from(sessionsMap.values()) });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
