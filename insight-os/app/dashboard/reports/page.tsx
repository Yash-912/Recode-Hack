'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText, Download, Loader2, Brain, TrendingUp, TrendingDown,
  AlertTriangle, AlertCircle, Info, ChevronRight, BarChart3,
  Globe2, Smartphone, Monitor, Target, ArrowRight, Sparkles,
  Shield, Clock, Eye, MousePointerClick, Users, Zap
} from 'lucide-react';

interface ReportData {
  report: {
    executive_summary: string;
    key_metrics_analysis: string;
    traffic_insights: {
      overview: string;
      peak_days: string;
      geographic_breakdown: string;
    };
    user_behavior: {
      journey_analysis: string;
      engagement_quality: string;
      device_analysis: string;
    };
    funnel_performance: string;
    top_pages_analysis: string;
    actionable_recommendations: Array<{
      priority: string;
      title: string;
      description: string;
      expected_impact: string;
    }>;
    risk_alerts: Array<{
      severity: string;
      alert: string;
    }>;
    next_week_focus: string;
    xai_transparency: {
      data_points_analyzed: number;
      confidence_level: string;
      methodology: string;
      limitations: string;
    };
  };
  rawData: {
    site: string;
    reportPeriod: string;
    generatedAt: string;
    metrics: {
      totalPageviews: number;
      totalClicks: number;
      totalSessions: number;
      uniquePages: number;
      conversionRate: string;
      bounceRate: string;
      avgSessionDuration: string;
      deviceSplit: { mobile: number; desktop: number };
    };
    topPages: Array<{ url: string; views: number }>;
    topCountries: Array<{ country: string; events: number }>;
    dailyTrend: Array<{ day: string; pageviews: number; clicks: number }>;
    funnels: any[];
  };
  metadata: {
    generatedAt: string;
    period: string;
    site: string;
    aiModel: string;
  };
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site') || 'cmnjoenvi000004jp2ge44k3j';
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRange, setSelectedRange] = useState('7d');
  const [error, setError] = useState('');

  const generateReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, range: selectedRange }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setReport(data);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadAsPDF = () => {
    if (!report) return;

    // Build a print-ready HTML document
    const html = buildReportHTML(report);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    // Auto-trigger print (Save as PDF) after content loads
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 500);
    };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-crimson-bright/20 to-red-900/20 border border-crimson-bright/30">
              <FileText className="w-6 h-6 text-crimson-bright" />
            </div>
            AI Analytics Reports
          </h1>
          <p className="text-zinc-500 mt-2 text-sm md:text-base">
            Comprehensive, explainable analytics reports powered by AI — downloadable as PDF for your team
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Range Selector */}
          <div className="flex bg-[#111] border border-[#333] rounded-lg overflow-hidden">
            {['24h', '7d', '30d'].map(r => (
              <button
                key={r}
                onClick={() => setSelectedRange(r)}
                className={`px-4 py-2 text-xs font-mono font-bold transition-all ${
                  selectedRange === r
                    ? 'bg-crimson-bright text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Generate Button */}
          <button
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-crimson-bright to-red-700 text-white rounded-lg font-semibold text-sm hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-950/50 border border-red-900/50 rounded-xl text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-crimson-bright/30 border-t-crimson-bright animate-spin" />
            <Brain className="w-8 h-8 text-crimson-bright absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <div className="text-white font-semibold text-lg">Analyzing your data...</div>
            <div className="text-zinc-500 text-sm mt-1">AI is reviewing sessions, funnels, traffic patterns & generating insights</div>
          </div>
          <div className="flex gap-2 mt-2">
            {['Fetching metrics', 'Analyzing sessions', 'Running AI', 'Building report'].map((step, i) => (
              <div key={step} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600 font-mono animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-crimson-bright/50" />
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !report && !error && (
        <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222]">
            <FileText className="w-16 h-16 text-zinc-700 mx-auto" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Generate Your First Report</h3>
            <p className="text-zinc-500 mt-2 max-w-md">
              Select a time period and click &ldquo;Generate Report&rdquo; to get a comprehensive AI-powered analytics report you can download and share with your team.
            </p>
          </div>
        </div>
      )}

      {/* Report Content */}
      {report && !loading && (
        <div className="space-y-6" id="report-content">
          {/* Download Bar */}
          <div className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-[#222] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-zinc-400">
                Report generated on {new Date(report.metadata.generatedAt).toLocaleString()} • {report.metadata.period}
              </span>
            </div>
            <button
              onClick={downloadAsPDF}
              className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] rounded-lg text-sm text-white hover:bg-[#1a1a1a] hover:border-crimson-bright/50 transition-all group"
            >
              <Download className="w-4 h-4 text-crimson-bright group-hover:animate-bounce" />
              Download PDF
            </button>
          </div>

          {/* Executive Summary */}
          <section className="p-6 bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-[#222] rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-crimson-bright/5 rounded-full blur-[80px] pointer-events-none" />
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-crimson-bright" />
              Executive Summary
            </h2>
            <p className="text-zinc-300 leading-relaxed text-sm md:text-base">{report.report.executive_summary}</p>
          </section>

          {/* Key Metrics Grid */}
          <section>
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-crimson-bright" />
              Key Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard icon={Eye} label="Pageviews" value={report.rawData.metrics.totalPageviews.toLocaleString()} />
              <MetricCard icon={MousePointerClick} label="Clicks" value={report.rawData.metrics.totalClicks.toLocaleString()} />
              <MetricCard icon={Users} label="Sessions" value={report.rawData.metrics.totalSessions.toLocaleString()} />
              <MetricCard icon={Target} label="Conversion" value={report.rawData.metrics.conversionRate} variant="green" />
              <MetricCard icon={TrendingDown} label="Bounce Rate" value={report.rawData.metrics.bounceRate} variant="amber" />
              <MetricCard icon={Clock} label="Avg Duration" value={report.rawData.metrics.avgSessionDuration} />
              <MetricCard icon={Smartphone} label="Mobile" value={report.rawData.metrics.deviceSplit.mobile.toString()} />
              <MetricCard icon={Monitor} label="Desktop" value={report.rawData.metrics.deviceSplit.desktop.toString()} />
            </div>
          </section>

          {/* Detailed AI Analysis */}
          <section className="p-6 bg-[#0a0a0a] border border-[#222] rounded-2xl space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-crimson-bright" />
              Detailed Analysis
            </h2>

            {/* Metrics Analysis */}
            <AnalysisBlock title="Metrics Deep-Dive" icon={BarChart3}>
              {report.report.key_metrics_analysis}
            </AnalysisBlock>

            {/* Traffic Insights */}
            <AnalysisBlock title="Traffic Patterns" icon={TrendingUp}>
              <p className="mb-3">{report.report.traffic_insights.overview}</p>
              {report.report.traffic_insights.peak_days && (
                <div className="pl-4 border-l-2 border-crimson-bright/30 mb-3">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Peak Days</span>
                  <p className="text-zinc-400 text-sm mt-1">{report.report.traffic_insights.peak_days}</p>
                </div>
              )}
              {report.report.traffic_insights.geographic_breakdown && (
                <div className="pl-4 border-l-2 border-blue-500/30">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Geographic Breakdown</span>
                  <p className="text-zinc-400 text-sm mt-1">{report.report.traffic_insights.geographic_breakdown}</p>
                </div>
              )}
            </AnalysisBlock>

            {/* User Behavior */}
            <AnalysisBlock title="User Behavior" icon={Users}>
              <p className="mb-3">{report.report.user_behavior.journey_analysis}</p>
              {report.report.user_behavior.engagement_quality && (
                <div className="pl-4 border-l-2 border-green-500/30 mb-3">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Engagement Quality</span>
                  <p className="text-zinc-400 text-sm mt-1">{report.report.user_behavior.engagement_quality}</p>
                </div>
              )}
              {report.report.user_behavior.device_analysis && (
                <div className="pl-4 border-l-2 border-purple-500/30">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Device Analysis</span>
                  <p className="text-zinc-400 text-sm mt-1">{report.report.user_behavior.device_analysis}</p>
                </div>
              )}
            </AnalysisBlock>

            {/* Funnel Performance */}
            <AnalysisBlock title="Funnel Performance" icon={Target}>
              {report.report.funnel_performance}
            </AnalysisBlock>

            {/* Top Pages */}
            <AnalysisBlock title="Page Performance" icon={FileText}>
              {report.report.top_pages_analysis}
            </AnalysisBlock>
          </section>

          {/* Top Pages Table */}
          {report.rawData.topPages.length > 0 && (
            <section className="p-6 bg-[#0a0a0a] border border-[#222] rounded-2xl">
              <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-crimson-bright" />
                Top Pages
              </h2>
              <div className="space-y-2">
                {report.rawData.topPages.map((page, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 bg-[#111] rounded-lg border border-[#1a1a1a] hover:border-[#333] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600 font-mono w-6">#{i + 1}</span>
                      <span className="text-sm text-zinc-300 font-mono truncate max-w-[300px] md:max-w-[500px]">{page.url}</span>
                    </div>
                    <span className="text-sm text-white font-bold">{page.views}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Top Countries */}
          {report.rawData.topCountries.length > 0 && (
            <section className="p-6 bg-[#0a0a0a] border border-[#222] rounded-2xl">
              <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-4 flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-crimson-bright" />
                Geographic Distribution
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {report.rawData.topCountries.map((c, i) => (
                  <div key={i} className="p-3 bg-[#111] rounded-lg border border-[#1a1a1a] text-center">
                    <div className="text-lg font-bold text-white">{c.country}</div>
                    <div className="text-xs text-zinc-500 mt-1">{c.events} events</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Actionable Recommendations */}
          {report.report.actionable_recommendations?.length > 0 && (
            <section className="p-6 bg-[#0a0a0a] border border-[#222] rounded-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                <Zap className="w-5 h-5 text-yellow-500" />
                Actionable Recommendations
              </h2>
              <div className="space-y-4">
                {report.report.actionable_recommendations.map((rec, i) => (
                  <div key={i} className={`p-5 rounded-xl border-l-4 ${
                    rec.priority === 'HIGH' ? 'border-l-red-500 bg-red-950/10' :
                    rec.priority === 'MEDIUM' ? 'border-l-yellow-500 bg-yellow-950/10' :
                    'border-l-blue-500 bg-blue-950/10'
                  } border-y border-y-[#222] border-r border-r-[#222]`}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                        {rec.title}
                      </h4>
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                        rec.priority === 'HIGH' ? 'bg-red-950 text-red-400 border border-red-900' :
                        rec.priority === 'MEDIUM' ? 'bg-yellow-950 text-yellow-400 border border-yellow-900' :
                        'bg-blue-950 text-blue-400 border border-blue-900'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed mb-3">{rec.description}</p>
                    <div className="flex items-center gap-2 text-xs text-green-500/80">
                      <ArrowRight className="w-3 h-3" />
                      <span className="font-medium">Expected Impact:</span>
                      <span className="text-zinc-400">{rec.expected_impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Risk Alerts */}
          {report.report.risk_alerts?.length > 0 && (
            <section className="p-6 bg-[#0a0a0a] border border-[#222] rounded-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                <Shield className="w-5 h-5 text-amber-500" />
                Risk Alerts
              </h2>
              <div className="space-y-3">
                {report.report.risk_alerts.map((alert, i) => (
                  <div key={i} className={`flex items-start gap-3 p-4 rounded-lg border ${
                    alert.severity === 'critical' ? 'border-red-900/50 bg-red-950/20' :
                    alert.severity === 'warning' ? 'border-yellow-900/50 bg-yellow-950/20' :
                    'border-blue-900/50 bg-blue-950/20'
                  }`}>
                    {alert.severity === 'critical' ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> :
                     alert.severity === 'warning' ? <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" /> :
                     <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />}
                    <p className="text-sm text-zinc-300">{alert.alert}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Next Week Focus */}
          {report.report.next_week_focus && (
            <section className="p-6 bg-gradient-to-r from-crimson-bright/10 to-transparent border border-crimson-bright/20 rounded-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                <ArrowRight className="w-5 h-5 text-crimson-bright" />
                Next Week&apos;s Focus
              </h2>
              <p className="text-zinc-300 text-sm leading-relaxed">{report.report.next_week_focus}</p>
            </section>
          )}

          {/* XAI Transparency */}
          {report.report.xai_transparency && (
            <section className="p-5 bg-[#080808] border border-[#1a1a1a] rounded-xl">
              <h3 className="text-xs uppercase tracking-widest text-zinc-600 font-bold mb-3 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-zinc-600" />
                AI Transparency & Methodology
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-600 text-xs">Data Points Analyzed</span>
                  <p className="text-zinc-400">{report.report.xai_transparency.data_points_analyzed}</p>
                </div>
                <div>
                  <span className="text-zinc-600 text-xs">Confidence Level</span>
                  <p className={`font-semibold ${
                    report.report.xai_transparency.confidence_level === 'HIGH' ? 'text-green-500' :
                    report.report.xai_transparency.confidence_level === 'MEDIUM' ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {report.report.xai_transparency.confidence_level}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-600 text-xs">Methodology</span>
                  <p className="text-zinc-500 text-xs leading-relaxed">{report.report.xai_transparency.methodology}</p>
                </div>
                <div>
                  <span className="text-zinc-600 text-xs">Limitations</span>
                  <p className="text-zinc-500 text-xs leading-relaxed">{report.report.xai_transparency.limitations}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#1a1a1a] text-[10px] text-zinc-700 font-mono">
                Model: {report.metadata.aiModel} • Generated: {new Date(report.metadata.generatedAt).toLocaleString()}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, variant }: {
  icon: any; label: string; value: string; variant?: 'green' | 'amber';
}) {
  return (
    <div className="p-4 bg-[#0a0a0a] border border-[#222] rounded-xl group hover:border-[#333] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${
          variant === 'green' ? 'text-green-500' :
          variant === 'amber' ? 'text-amber-500' :
          'text-zinc-500'
        }`} />
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${
        variant === 'green' ? 'text-green-400' :
        variant === 'amber' ? 'text-amber-400' :
        'text-white'
      }`}>
        {value}
      </div>
    </div>
  );
}

function AnalysisBlock({ title, icon: Icon, children }: {
  title: string; icon: any; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Icon className="w-4 h-4 text-zinc-500" />
        {title}
      </h3>
      <div className="text-sm text-zinc-400 leading-relaxed pl-6">{children}</div>
    </div>
  );
}

// ─── PDF HTML Builder ────────────────────────────────────────

function buildReportHTML(data: ReportData): string {
  const { report, rawData, metadata } = data;
  const m = rawData.metrics;

  const recRows = (report.actionable_recommendations || []).map(r => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee">
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;color:white;background:${
          r.priority === 'HIGH' ? '#dc2626' : r.priority === 'MEDIUM' ? '#d97706' : '#2563eb'
        }">${r.priority}</span>
      </td>
      <td style="padding:10px;border-bottom:1px solid #eee;font-weight:600">${r.title}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;color:#555;font-size:13px">${r.description}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;color:#16a34a;font-size:13px">${r.expected_impact}</td>
    </tr>
  `).join('');

  const riskRows = (report.risk_alerts || []).map(a => `
    <div style="padding:12px 16px;margin-bottom:8px;background:${
      a.severity === 'critical' ? '#fef2f2' : a.severity === 'warning' ? '#fffbeb' : '#eff6ff'
    };border-left:4px solid ${
      a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#d97706' : '#2563eb'
    };border-radius:6px;font-size:14px;color:#333">
      <strong style="text-transform:uppercase;font-size:11px;color:${
        a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#d97706' : '#2563eb'
      }">${a.severity}</strong>
      <p style="margin:4px 0 0 0">${a.alert}</p>
    </div>
  `).join('');

  const topPagesRows = rawData.topPages.map((p, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#888;font-size:12px">#${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:13px">${p.url}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-weight:700;text-align:right">${p.views}</td>
    </tr>
  `).join('');

  const countryCells = rawData.topCountries.map(c => `
    <div style="display:inline-block;text-align:center;padding:12px 18px;margin:4px;background:#f8f8f8;border-radius:8px;border:1px solid #eee">
      <div style="font-size:18px;font-weight:700">${c.country}</div>
      <div style="font-size:11px;color:#888;margin-top:2px">${c.events} events</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Analytics Report — ${metadata.site} — ${metadata.period}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 50px; max-width: 900px; margin: 0 auto; background: white; }
    @media print { body { padding: 30px; } }
    h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 700; color: #111; margin: 32px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0; }
    h3 { font-size: 14px; font-weight: 600; color: #333; margin: 16px 0 6px; }
    p { font-size: 14px; color: #444; margin-bottom: 10px; }
    .header { border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
    .header .subtitle { color: #888; font-size: 14px; }
    .header .brand { color: #dc2626; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .metric-box { padding: 16px; background: #fafafa; border: 1px solid #eee; border-radius: 10px; text-align: center; }
    .metric-box .value { font-size: 26px; font-weight: 800; color: #111; }
    .metric-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 600; margin-top: 4px; }
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .insight-box { padding: 16px 20px; background: #f8f8f8; border-left: 4px solid #dc2626; border-radius: 0 8px 8px 0; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; border-bottom: 2px solid #e0e0e0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #f0f0f0; color: #aaa; font-size: 11px; text-align: center; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Insight-OS Analytics</div>
    <h1>Weekly Analytics Report</h1>
    <div class="subtitle">${metadata.site} • ${metadata.period} • Generated ${new Date(metadata.generatedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

  <div class="section">
    <h2>📊 Executive Summary</h2>
    <div class="insight-box">
      <p style="margin:0;font-size:15px;color:#222">${report.executive_summary}</p>
    </div>
  </div>

  <div class="section">
    <h2>📈 Key Metrics</h2>
    <div class="metrics-grid">
      <div class="metric-box"><div class="value">${m.totalPageviews.toLocaleString()}</div><div class="label">Pageviews</div></div>
      <div class="metric-box"><div class="value">${m.totalClicks.toLocaleString()}</div><div class="label">Clicks</div></div>
      <div class="metric-box"><div class="value">${m.totalSessions.toLocaleString()}</div><div class="label">Sessions</div></div>
      <div class="metric-box"><div class="value">${m.conversionRate}</div><div class="label">Conversion Rate</div></div>
      <div class="metric-box"><div class="value">${m.bounceRate}</div><div class="label">Bounce Rate</div></div>
      <div class="metric-box"><div class="value">${m.avgSessionDuration}</div><div class="label">Avg Duration</div></div>
      <div class="metric-box"><div class="value">${m.deviceSplit.mobile}</div><div class="label">Mobile Users</div></div>
      <div class="metric-box"><div class="value">${m.deviceSplit.desktop}</div><div class="label">Desktop Users</div></div>
    </div>
    <p>${report.key_metrics_analysis}</p>
  </div>

  <div class="section">
    <h2>🌐 Traffic Insights</h2>
    <p>${report.traffic_insights.overview}</p>
    ${report.traffic_insights.peak_days ? `<h3>Peak Days</h3><p>${report.traffic_insights.peak_days}</p>` : ''}
    ${report.traffic_insights.geographic_breakdown ? `<h3>Geographic Breakdown</h3><p>${report.traffic_insights.geographic_breakdown}</p>` : ''}
    ${countryCells ? `<div style="margin-top:12px">${countryCells}</div>` : ''}
  </div>

  <div class="section page-break">
    <h2>👤 User Behavior Analysis</h2>
    <p>${report.user_behavior.journey_analysis}</p>
    ${report.user_behavior.engagement_quality ? `<h3>Engagement Quality</h3><p>${report.user_behavior.engagement_quality}</p>` : ''}
    ${report.user_behavior.device_analysis ? `<h3>Device Analysis</h3><p>${report.user_behavior.device_analysis}</p>` : ''}
  </div>

  <div class="section">
    <h2>🎯 Funnel Performance</h2>
    <p>${report.funnel_performance}</p>
  </div>

  <div class="section">
    <h2>📄 Top Pages</h2>
    <p>${report.top_pages_analysis}</p>
    ${topPagesRows ? `
    <table style="margin-top:12px">
      <thead><tr><th>#</th><th>Page URL</th><th style="text-align:right">Views</th></tr></thead>
      <tbody>${topPagesRows}</tbody>
    </table>` : ''}
  </div>

  <div class="section page-break">
    <h2>⚡ Actionable Recommendations</h2>
    ${recRows ? `
    <table>
      <thead><tr><th>Priority</th><th>Recommendation</th><th>Details</th><th>Expected Impact</th></tr></thead>
      <tbody>${recRows}</tbody>
    </table>` : '<p>No specific recommendations at this time.</p>'}
  </div>

  ${riskRows ? `
  <div class="section">
    <h2>⚠️ Risk Alerts</h2>
    ${riskRows}
  </div>` : ''}

  <div class="section">
    <h2>🔮 Next Week's Focus</h2>
    <div class="insight-box">
      <p style="margin:0">${report.next_week_focus}</p>
    </div>
  </div>

  <div class="section" style="background:#f8f8f8;padding:20px;border-radius:12px;margin-top:32px">
    <h2 style="border:none;margin-top:0;font-size:14px;color:#888">🧠 AI Transparency (XAI)</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px">
      <div><strong>Data Points Analyzed:</strong> ${report.xai_transparency?.data_points_analyzed || 'N/A'}</div>
      <div><strong>Confidence:</strong> ${report.xai_transparency?.confidence_level || 'N/A'}</div>
      <div style="grid-column:span 2"><strong>Methodology:</strong> ${report.xai_transparency?.methodology || 'N/A'}</div>
      <div style="grid-column:span 2"><strong>Limitations:</strong> ${report.xai_transparency?.limitations || 'N/A'}</div>
    </div>
  </div>

  <div class="footer">
    <p>Generated by <strong>Insight-OS</strong> AI Analytics Engine • Model: ${metadata.aiModel}</p>
    <p>This report is auto-generated using Explainable AI. All insights reference actual telemetry data.</p>
  </div>
</body>
</html>`;
}
