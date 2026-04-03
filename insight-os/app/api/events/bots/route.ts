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
    // ─── Task 2A.10: Backend query for the Bot Audit Demo Panel ──
    const bots = await prisma.event.findMany({
      where: {
        siteId,
        isBot: true,
      },
      orderBy: { ts: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        url: true,
        uaRaw: true,
        country: true,
        ts: true,
      }
    });

    const safeBots = bots.map((b: any) => ({
      ...b,
      id: b.id.toString(), // Convert BigInt
      reason: 'Flagged by Velocity/UA/Spam Check'
    }));

    return NextResponse.json({ bots: safeBots });

  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
