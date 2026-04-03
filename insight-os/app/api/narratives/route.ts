import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { askGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { session_hash, site_id } = body;

    if (!session_hash || !site_id) {
      return NextResponse.json({ error: 'Missing session_hash or site_id' }, { status: 400 });
    }

    // Fetch all events for this session
    const events = await prisma.event.findMany({
      where: { siteId: site_id, sessionHash: session_hash, isBot: false },
      orderBy: { ts: 'asc' },
      select: { type: true, url: true, xPct: true, yPct: true, country: true, uaRaw: true, ts: true }
    });

    if (events.length === 0) {
      return NextResponse.json({ narrative: 'No events found.', xai: { reasoning: 'Empty session', confidence: 0 } });
    }

    // Format journey
    const journey = events.map((e, i) => {
      const ts = new Date(e.ts).toLocaleTimeString();
      if (e.type === 'pageview') return `[${ts}] Step ${i + 1}: Visited ${e.url || '/'}`;
      if (e.type === 'click') return `[${ts}] Step ${i + 1}: Clicked at (${e.xPct?.toFixed(0)}%, ${e.yPct?.toFixed(0)}%) on ${e.url || '/'}`;
      return `[${ts}] Step ${i + 1}: ${e.type} on ${e.url || '/'}`;
    }).join('\n');

    // Parse device + context
    const ua = events[0].uaRaw || '';
    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    const device = isMobile ? 'Mobile' : 'Desktop';
    const country = events[0].country || 'Unknown';
    const pageviews = events.filter(e => e.type === 'pageview');
    const clicks = events.filter(e => e.type === 'click');
    const uniquePages = [...new Set(pageviews.map(e => e.url))];
    const lastPage = pageviews[pageviews.length - 1]?.url || '/';
    const didConvert = lastPage.includes('thank') || lastPage.includes('success') || lastPage.includes('confirm');

    // Time spent calculation
    const sessionStart = new Date(events[0].ts).getTime();
    const sessionEnd = new Date(events[events.length - 1].ts).getTime();
    const durationSec = Math.round((sessionEnd - sessionStart) / 1000);

    // XAI evidence for this session
    const sessionEvidence = {
      device, country,
      total_events: events.length,
      pageviews: pageviews.length,
      clicks: clicks.length,
      unique_pages: uniquePages.length,
      duration_seconds: durationSec,
      last_page: lastPage,
      converted: didConvert,
      pages_visited: uniquePages,
    };

    const prompt = `You are an XAI (Explainable AI) analytics engine analyzing a single user session. Write TWO things:

1. A "narrative" — a 2-3 sentence behavioral story about what the user did and their likely intent.
2. A "reasoning" — a step-by-step explanation of HOW you reached your conclusions, referencing specific data points.

Session Evidence:
${JSON.stringify(sessionEvidence, null, 2)}

Journey Timeline:
${journey}

Respond as JSON with exactly these fields:
{
  "narrative": "the behavioral story",
  "reasoning": "step-by-step XAI explanation",
  "intent": "one of: browsing | comparing | buying | bouncing | exploring",
  "confidence": number 0-100,
  "key_observation": "the single most important thing about this session"
}

Respond with ONLY valid JSON. No markdown, no code fences.`;

    const raw = await askGemini(prompt);

    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { narrative: raw, reasoning: 'Raw output', intent: 'unknown', confidence: 50, key_observation: '' };
    }

    return NextResponse.json({
      ...parsed,
      xai: {
        model: 'gemini-2.5-flash',
        evidence: sessionEvidence,
        data_points_used: Object.keys(sessionEvidence).length,
        transparency_note: 'Narrative is generated from raw event data. The reasoning chain shows exactly which data points influenced the conclusion.',
      }
    });

  } catch (error: any) {
    console.error('[XAI Narratives] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
