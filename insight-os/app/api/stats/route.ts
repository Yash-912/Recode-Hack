import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('site_id');
  const range = searchParams.get('range') || '24h'; // 24h, 7d, 30d

  if (!siteId) {
    return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
  }

  // Calculate the time boundary
  const hoursToSubtract = range === '7d' ? 24 * 7 : range === '30d' ? 24 * 30 : 24;
  const since = new Date(Date.now() - hoursToSubtract * 60 * 60 * 1000);

  try {
    // 1B.8 — Queries pre-aggregated hourly_stats, making it incredibly fast
    // no matter how many raw events exist.
    const stats = await prisma.hourlyStat.findMany({
      where: {
        siteId,
        hour: { gte: since }
      },
      orderBy: { hour: 'asc' }
    });

    // We can also compute totals directly in-memory since array is small (max 720 items for 30d)
    const summary = stats.reduce(
      (acc, s) => {
        acc.pageviews += s.pageviews;
        acc.clicks += s.clicks;
        return acc;
      },
      { pageviews: 0, clicks: 0 }
    );

    return NextResponse.json({ summary, hourly: stats });

  } catch (err) {
    console.error('[API Stats] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
