import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('site_id');
  const targetUrl = searchParams.get('url');

  if (!siteId || !targetUrl) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // 2B.7 Pull exact X/Y coordinate clicks for Heatmap Rendering layer
    const clicks = await prisma.event.findMany({
      where: {
        siteId,
        url: { contains: targetUrl },
        type: 'click',
        isBot: false,
        xPct: { not: null },
        yPct: { not: null }
      },
      select: { xPct: true, yPct: true },
      take: 1500 // Cap to prevent crashing browser canvas
    });

    return NextResponse.json({ clicks });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
