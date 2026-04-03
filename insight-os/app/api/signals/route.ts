import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { askGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { site_id } = body;

    if (!site_id) {
      return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
    }

    // Fetch last 24h of hourly stats
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stats = await prisma.hourlyStat.findMany({
      where: { siteId: site_id, hour: { gte: since } },
      orderBy: { hour: 'asc' }
    });

    if (stats.length === 0) {
      return NextResponse.json({
        signals: [{
          severity: 'info', title: 'No Data Yet',
          body: 'Not enough data to generate insights.',
          confidence: 0,
          evidence: [],
          reasoning: 'No hourly stats found in the last 24 hours.',
          data_points_used: 0,
        }]
      });
    }

    // ─── Pre-compute metrics for XAI evidence ────────────
    const totalPV = stats.reduce((s, h) => s + h.pageviews, 0);
    const totalClicks = stats.reduce((s, h) => s + h.clicks, 0);
    const avgPV = totalPV / stats.length;
    const maxHour = stats.reduce((max, h) => h.pageviews > max.pageviews ? h : max, stats[0]);
    const minHour = stats.reduce((min, h) => h.pageviews < min.pageviews ? h : min, stats[0]);
    const ctr = totalPV > 0 ? ((totalClicks / totalPV) * 100).toFixed(1) : '0';

    // Spike detection
    const spikes = stats.filter(h => h.pageviews > avgPV * 2);
    const dips = stats.filter(h => h.pageviews < avgPV * 0.3 && h.pageviews > 0);

    // Top pages across all hours
    const allTopPages = stats.flatMap(h => {
      try { return Array.isArray(h.topPages) ? h.topPages as any[] : JSON.parse(h.topPages as string); } catch { return []; }
    });

    // Build evidence array for transparency
    const evidence = [
      { metric: 'total_pageviews', value: totalPV, source: 'hourly_stats', hours_sampled: stats.length },
      { metric: 'total_clicks', value: totalClicks, source: 'hourly_stats', hours_sampled: stats.length },
      { metric: 'click_through_rate', value: `${ctr}%`, source: 'computed(clicks/pageviews)' },
      { metric: 'hourly_average_pv', value: Math.round(avgPV), source: 'computed(total/hours)' },
      { metric: 'peak_hour', value: maxHour.hour, pageviews: maxHour.pageviews, source: 'hourly_stats' },
      { metric: 'lowest_hour', value: minHour.hour, pageviews: minHour.pageviews, source: 'hourly_stats' },
      { metric: 'spike_count', value: spikes.length, threshold: `>${Math.round(avgPV * 2)} PV (2x avg)`, source: 'anomaly_detection' },
      { metric: 'dip_count', value: dips.length, threshold: `<${Math.round(avgPV * 0.3)} PV (30% avg)`, source: 'anomaly_detection' },
    ];

    const prompt = `You are an XAI (Explainable AI) analytics advisor. You must generate insights WITH full transparency about your reasoning.

For each insight, you MUST provide:
1. A clear conclusion
2. The exact data points that led to your conclusion
3. Your confidence level (0-100%)
4. Your reasoning chain (step-by-step logic)

Based on these metrics, generate exactly 3 signal cards as a JSON array:

Raw Evidence Data:
${JSON.stringify(evidence, null, 2)}

Top Pages: ${JSON.stringify(allTopPages.slice(0, 10))}

Each card MUST have these fields:
- severity: "critical" | "warning" | "info"
- title: short title (5-8 words)
- body: 1-2 sentence actionable insight
- confidence: number 0-100
- reasoning: 1-2 sentences explaining WHY you reached this conclusion
- evidence_used: array of metric names from the evidence data you relied on

Respond with ONLY a valid JSON array. No markdown, no code fences.`;

    const raw = await askGemini(prompt);

    let signals;
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      signals = JSON.parse(cleaned);
    } catch {
      signals = [{ severity: 'info', title: 'AI Analysis', body: raw, confidence: 50, reasoning: 'Raw output', evidence_used: [] }];
    }

    return NextResponse.json({
      signals,
      xai: {
        model: 'gemini-2.5-flash',
        evidence_provided: evidence,
        data_points_used: evidence.length,
        hours_analyzed: stats.length,
        generated_at: new Date().toISOString(),
        transparency_note: 'All insights are derived from pre-aggregated hourly_stats. Evidence chain shows exact metrics used. Confidence scores reflect data quality and pattern strength.',
      }
    });

  } catch (error: any) {
    console.error('[XAI Signals] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}
