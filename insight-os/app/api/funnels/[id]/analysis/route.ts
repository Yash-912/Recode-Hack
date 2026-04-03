import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Await params for Next.js >= 15 compatibility
  const resolvedParams = await params;
  const funnelId = resolvedParams.id;

  try {
    const funnel = await prisma.funnel.findUnique({ where: { id: funnelId } });
    if (!funnel) return NextResponse.json({ error: 'Funnel Not Found' }, { status: 404 });

    const steps = funnel.steps as string[];
    const windowDate = new Date(Date.now() - funnel.windowHours * 60 * 60 * 1000);
    const siteId = funnel.siteId;

    const results = [];
    let previousSessions = 0;
    let validSessionHashes = new Set<string>();

    /* 
     * Task 2B.3 Funnel Analysis Engine
     * We sequentially filter sessionHashes that hit step 1, 
     * then only keep those passing step 2, etc. simulating a multi-step CTE.
     */
    for (let i = 0; i < steps.length; i++) {
      const stepUrl = steps[i];
      
      if (i === 0) {
        const step1Events = await prisma.event.findMany({
          where: { siteId, url: { contains: stepUrl }, ts: { gte: windowDate }, isBot: false },
          select: { sessionHash: true }
        });
        step1Events.forEach(e => { if (e.sessionHash) validSessionHashes.add(e.sessionHash) });
      } else {
        const nextEvents = await prisma.event.findMany({
          where: { 
            siteId, 
            url: { contains: stepUrl }, 
            sessionHash: { in: Array.from(validSessionHashes) } 
          },
          select: { sessionHash: true }
        });
        
        const currentHashes = new Set<string>();
        nextEvents.forEach(e => { if (e.sessionHash) currentHashes.add(e.sessionHash) });
        validSessionHashes = currentHashes; // Narrow down the passing cohort
      }

      const currentCount = validSessionHashes.size;
      const dropPct = previousSessions === 0 
        ? 0 
        : parseFloat((((previousSessions - currentCount) / previousSessions) * 100).toFixed(1));

      results.push({
        step: i + 1,
        url: stepUrl,
        sessions: currentCount,
        drop_pct: dropPct
      });
      previousSessions = currentCount;
    }

    return NextResponse.json({ analysis: results });

  } catch (error) {
    console.error('[API Funnel Analysis] Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
