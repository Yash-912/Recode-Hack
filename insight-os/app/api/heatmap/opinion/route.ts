import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { askGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { site_id, url } = body;

    if (!site_id || !url) {
      return NextResponse.json({ error: 'Missing site_id or url' }, { status: 400 });
    }

    // Fetch click events for this URL
    const clicks = await prisma.event.findMany({
      where: { siteId: site_id, type: 'click', isBot: false, url: { contains: url } },
      select: { xPct: true, yPct: true },
      take: 500
    });

    if (clicks.length < 5) {
      return NextResponse.json({
        opinion: 'Not enough click data to analyze.',
        xai: { confidence: 0, reasoning: 'Less than 5 clicks recorded for this URL.' }
      });
    }

    // ─── Compute click distribution statistics ────────────
    const xValues = clicks.filter(c => c.xPct !== null).map(c => c.xPct!);
    const yValues = clicks.filter(c => c.yPct !== null).map(c => c.yPct!);

    const avgX = xValues.reduce((a, b) => a + b, 0) / xValues.length;
    const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    const stdX = Math.sqrt(xValues.reduce((sum, x) => sum + (x - avgX) ** 2, 0) / xValues.length);
    const stdY = Math.sqrt(yValues.reduce((sum, y) => sum + (y - avgY) ** 2, 0) / yValues.length);

    // Quadrant analysis
    const quadrants = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
    for (const c of clicks) {
      if (c.xPct === null || c.yPct === null) continue;
      if (c.xPct < 50 && c.yPct < 50) quadrants.topLeft++;
      else if (c.xPct >= 50 && c.yPct < 50) quadrants.topRight++;
      else if (c.xPct < 50 && c.yPct >= 50) quadrants.bottomLeft++;
      else quadrants.bottomRight++;
    }

    const totalQ = Object.values(quadrants).reduce((a, b) => a + b, 0);
    const quadrantPcts = {
      topLeft: ((quadrants.topLeft / totalQ) * 100).toFixed(1),
      topRight: ((quadrants.topRight / totalQ) * 100).toFixed(1),
      bottomLeft: ((quadrants.bottomLeft / totalQ) * 100).toFixed(1),
      bottomRight: ((quadrants.bottomRight / totalQ) * 100).toFixed(1),
    };

    // Hotspot detection (cluster analysis)
    const isConcentrated = stdX < 20 && stdY < 20;
    const dominantQuadrant = Object.entries(quadrants).sort((a, b) => b[1] - a[1])[0];

    const evidence = {
      total_clicks: clicks.length,
      url,
      average_x: avgX.toFixed(1) + '%',
      average_y: avgY.toFixed(1) + '%',
      std_deviation_x: stdX.toFixed(1),
      std_deviation_y: stdY.toFixed(1),
      is_concentrated: isConcentrated,
      quadrant_distribution: quadrantPcts,
      dominant_quadrant: `${dominantQuadrant[0]} (${((dominantQuadrant[1] / totalQ) * 100).toFixed(0)}%)`,
    };

    const prompt = `You are an XAI UX analytics engine. Analyze this heatmap click data and provide:

1. A concise "opinion" (2-3 sentences) about the click pattern and what it means for UX.
2. A "reasoning" chain explaining HOW you reached your conclusions from the evidence.
3. A specific "recommendation" for improving the page layout.

Click Evidence:
${JSON.stringify(evidence, null, 2)}

Respond as JSON with these fields:
{
  "opinion": "the UX analysis",
  "reasoning": "step-by-step evidence-based reasoning",
  "recommendation": "specific actionable UX recommendation",
  "confidence": number 0-100,
  "key_finding": "single most important observation"
}

Respond with ONLY valid JSON. No markdown, no code fences.`;

    const raw = await askGemini(prompt);

    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { opinion: raw, reasoning: 'Raw output', recommendation: '', confidence: 50, key_finding: '' };
    }

    return NextResponse.json({
      ...parsed,
      xai: {
        model: 'gemini-2.5-flash',
        evidence,
        statistical_methods: ['mean', 'standard_deviation', 'quadrant_analysis', 'concentration_detection'],
        data_points_used: clicks.length,
        transparency_note: 'Opinion is derived from statistical analysis of click coordinates. Quadrant distribution and concentration metrics are computed server-side before being sent to the AI.',
      }
    });

  } catch (error: any) {
    console.error('[Heatmap XAI] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
