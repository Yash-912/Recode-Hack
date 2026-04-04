import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { askGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for AI generation

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { site_id, range = '7d' } = body;

    if (!site_id) {
      return NextResponse.json({ error: 'Missing site_id' }, { status: 400 });
    }

    // ─── 1. Calculate time boundary ───────────────────────
    const hoursBack = range === '30d' ? 24 * 30 : range === '24h' ? 24 : 24 * 7;
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const rangeLabel = range === '30d' ? 'Last 30 Days' : range === '24h' ? 'Last 24 Hours' : 'Last 7 Days';

    // ─── 2. Fetch all analytics data ──────────────────────
    const [hourlyStats, recentEvents, funnels, site] = await Promise.all([
      prisma.hourlyStat.findMany({
        where: { siteId: site_id, hour: { gte: since } },
        orderBy: { hour: 'asc' },
      }),
      prisma.event.findMany({
        where: { siteId: site_id, ts: { gte: since }, isBot: false },
        orderBy: { ts: 'desc' },
        take: 1000,
        select: {
          type: true, url: true, country: true, sessionHash: true,
          uaRaw: true, ts: true, xPct: true, yPct: true,
        },
      }),
      prisma.funnel.findMany({ where: { siteId: site_id } }),
      prisma.site.findUnique({ where: { id: site_id } }),
    ]);

    // ─── 3. Compute aggregate metrics ─────────────────────
    const totalPageviews = hourlyStats.reduce((s, h) => s + h.pageviews, 0);
    const totalClicks = hourlyStats.reduce((s, h) => s + h.clicks, 0);

    // Session analysis
    const sessionMap = new Map<string, typeof recentEvents>();
    for (const ev of recentEvents) {
      if (!ev.sessionHash) continue;
      if (!sessionMap.has(ev.sessionHash)) sessionMap.set(ev.sessionHash, []);
      sessionMap.get(ev.sessionHash)!.push(ev);
    }

    const totalSessions = sessionMap.size;
    const sessionDetails = Array.from(sessionMap.entries()).map(([hash, evts]) => {
      const sorted = evts.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      const pageviews = sorted.filter(e => e.type === 'pageview');
      const clicks = sorted.filter(e => e.type === 'click');
      const ua = sorted[0].uaRaw || '';
      const isMobile = /mobile|android|iphone|ipad/i.test(ua);
      const uniquePages = [...new Set(pageviews.map(e => e.url))];
      const lastPage = pageviews[pageviews.length - 1]?.url || '/';
      const didConvert = lastPage.includes('thank') || lastPage.includes('success') || lastPage.includes('confirm') || lastPage.includes('checkout');
      const startTs = new Date(sorted[0].ts).getTime();
      const endTs = new Date(sorted[sorted.length - 1].ts).getTime();
      return {
        hash: hash.substring(0, 8),
        device: isMobile ? 'mobile' : 'desktop',
        country: sorted[0].country || 'Unknown',
        events: sorted.length,
        pageviews: pageviews.length,
        clicks: clicks.length,
        uniquePages: uniquePages.length,
        pagesVisited: uniquePages,
        durationSec: Math.round((endTs - startTs) / 1000),
        converted: didConvert,
        lastPage,
      };
    });

    // Country breakdown
    const countryMap = new Map<string, number>();
    for (const ev of recentEvents) {
      if (ev.country) countryMap.set(ev.country, (countryMap.get(ev.country) || 0) + 1);
    }
    const topCountries = Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, events: count }));

    // Page popularity
    const pageMap = new Map<string, number>();
    for (const ev of recentEvents.filter(e => e.type === 'pageview')) {
      if (ev.url) pageMap.set(ev.url, (pageMap.get(ev.url) || 0) + 1);
    }
    const topPages = Array.from(pageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, views]) => ({ url, views }));

    // Device split
    const mobileCount = sessionDetails.filter(s => s.device === 'mobile').length;
    const desktopCount = sessionDetails.filter(s => s.device === 'desktop').length;

    // Conversion rate
    const convertedCount = sessionDetails.filter(s => s.converted).length;
    const conversionRate = totalSessions > 0 ? ((convertedCount / totalSessions) * 100).toFixed(1) : '0';

    // Bounce rate (sessions with only 1 pageview)
    const bouncedSessions = sessionDetails.filter(s => s.pageviews <= 1).length;
    const bounceRate = totalSessions > 0 ? ((bouncedSessions / totalSessions) * 100).toFixed(1) : '0';

    // Average session duration
    const avgDuration = sessionDetails.length > 0
      ? Math.round(sessionDetails.reduce((s, d) => s + d.durationSec, 0) / sessionDetails.length)
      : 0;

    // Hourly traffic trend (aggregate by day of week if 7d+)
    const trafficByDay = new Map<string, { pageviews: number; clicks: number }>();
    for (const h of hourlyStats) {
      const dayKey = new Date(h.hour).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const existing = trafficByDay.get(dayKey) || { pageviews: 0, clicks: 0 };
      existing.pageviews += h.pageviews;
      existing.clicks += h.clicks;
      trafficByDay.set(dayKey, existing);
    }
    const dailyTrend = Array.from(trafficByDay.entries()).map(([day, data]) => ({ day, ...data }));

    // ─── 4. Funnel analysis ───────────────────────────────
    const funnelResults = [];
    for (const funnel of funnels) {
      const steps = funnel.steps as string[];
      const stepCounts: number[] = [];

      for (const step of steps) {
        const count = await prisma.event.count({
          where: {
            siteId: site_id,
            ts: { gte: since },
            type: 'pageview',
            url: { contains: step },
            isBot: false,
          },
        });
        stepCounts.push(count);
      }

      funnelResults.push({
        name: funnel.name,
        steps: steps.map((s, i) => ({ path: s, visitors: stepCounts[i] })),
        overallConversion: stepCounts[0] > 0
          ? ((stepCounts[stepCounts.length - 1] / stepCounts[0]) * 100).toFixed(1) + '%'
          : '0%',
        biggestDrop: stepCounts.reduce((acc, count, i) => {
          if (i === 0) return acc;
          const dropPct = stepCounts[i - 1] > 0
            ? (((stepCounts[i - 1] - count) / stepCounts[i - 1]) * 100).toFixed(0)
            : '0';
          if (parseFloat(dropPct) > parseFloat(acc.dropPct)) {
            return { from: steps[i - 1], to: steps[i], dropPct };
          }
          return acc;
        }, { from: '', to: '', dropPct: '0' }),
      });
    }

    // ─── 5. Build analytics summary ───────────────────────
    const analyticsSummary = {
      site: site?.domain || site_id,
      reportPeriod: rangeLabel,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalPageviews,
        totalClicks,
        totalSessions,
        uniquePages: topPages.length,
        conversionRate: conversionRate + '%',
        bounceRate: bounceRate + '%',
        avgSessionDuration: avgDuration + 's',
        deviceSplit: { mobile: mobileCount, desktop: desktopCount },
      },
      topPages,
      topCountries,
      dailyTrend,
      funnels: funnelResults,
      sessionSample: sessionDetails.slice(0, 15),
    };

    // ─── 6. AI Analysis via OpenRouter ────────────────────
    const aiPrompt = `You are a SENIOR ANALYTICS CONSULTANT writing a comprehensive weekly analytics report for a website owner / product manager. This report should be EXPLAINABLE and ACTIONABLE — every insight must reference the actual data.

## Your Task
Write a detailed, professional analytics report based on the data below. The report will be converted to a downloadable PDF, so format it beautifully.

## Analytics Data (${rangeLabel})
${JSON.stringify(analyticsSummary, null, 2)}

## Report Structure Required:
Write the report in the following EXACT JSON structure:

{
  "executive_summary": "A 3-4 sentence high-level summary of website performance this period. Include the most important metric changes and overall health.",
  
  "key_metrics_analysis": "A detailed paragraph analyzing the core metrics: pageviews, clicks, sessions, bounce rate, conversion rate, avg session duration. Compare ratios and explain what they mean for the business.",
  
  "traffic_insights": {
    "overview": "2-3 sentences about traffic patterns",
    "peak_days": "Which days had highest traffic and why this might be",
    "geographic_breakdown": "Analysis of where users are coming from and implications"
  },
  
  "user_behavior": {
    "journey_analysis": "How users navigate through the site based on page data and session patterns",
    "engagement_quality": "Assessment of click-to-pageview ratio, session depth, time on site",
    "device_analysis": "Mobile vs desktop breakdown and what it means for UX priorities"
  },
  
  "funnel_performance": "Analysis of each funnel's conversion rates, where the biggest drops happen, and specific recommendations to improve each drop-off point. If no funnels exist, suggest what funnels should be set up.",
  
  "top_pages_analysis": "Which pages perform best, which underperform, and what patterns emerge from the page popularity data.",
  
  "actionable_recommendations": [
    {"priority": "HIGH/MEDIUM/LOW", "title": "short title", "description": "detailed recommendation with reasoning", "expected_impact": "what improvement to expect"},
    {"priority": "HIGH/MEDIUM/LOW", "title": "short title", "description": "detailed recommendation with reasoning", "expected_impact": "what improvement to expect"},
    {"priority": "HIGH/MEDIUM/LOW", "title": "short title", "description": "detailed recommendation with reasoning", "expected_impact": "what improvement to expect"},
    {"priority": "HIGH/MEDIUM/LOW", "title": "short title", "description": "detailed recommendation with reasoning", "expected_impact": "what improvement to expect"},
    {"priority": "HIGH/MEDIUM/LOW", "title": "short title", "description": "detailed recommendation with reasoning", "expected_impact": "what improvement to expect"}
  ],
  
  "risk_alerts": [
    {"severity": "critical/warning/info", "alert": "description of the risk and what to watch for"}
  ],
  
  "next_week_focus": "A 2-3 sentence recommendation on what to focus on next week based on this data.",
  
  "xai_transparency": {
    "data_points_analyzed": number,
    "confidence_level": "HIGH/MEDIUM/LOW", 
    "methodology": "Brief explanation of how conclusions were reached",
    "limitations": "What data gaps exist and how they might affect conclusions"
  }
}

Respond with ONLY valid JSON. No markdown, no code fences, no explanatory text outside the JSON.`;

    const rawAI = await askGemini(aiPrompt);

    let aiReport;
    try {
      const cleaned = rawAI.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiReport = JSON.parse(cleaned);
    } catch {
      aiReport = {
        executive_summary: rawAI,
        key_metrics_analysis: 'AI parsing failed — raw analysis included in summary.',
        traffic_insights: { overview: '', peak_days: '', geographic_breakdown: '' },
        user_behavior: { journey_analysis: '', engagement_quality: '', device_analysis: '' },
        funnel_performance: '',
        top_pages_analysis: '',
        actionable_recommendations: [],
        risk_alerts: [],
        next_week_focus: '',
        xai_transparency: { data_points_analyzed: 0, confidence_level: 'LOW', methodology: '', limitations: 'AI output could not be parsed.' },
      };
    }

    return NextResponse.json({
      report: aiReport,
      rawData: analyticsSummary,
      metadata: {
        generatedAt: new Date().toISOString(),
        period: rangeLabel,
        site: site?.domain || site_id,
        aiModel: 'openai/gpt-4o-mini via OpenRouter',
      },
    });

  } catch (error: any) {
    console.error('[Report Generation] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
