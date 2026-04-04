'use client';

import { Activity, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import OverviewCharts from '@/components/dashboard/OverviewCharts';
import SignalCards from '@/components/dashboard/SignalCards';
import LiveFeed from '@/components/dashboard/LiveFeed';

const TIME_RANGES = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

export default function DashboardOverview() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('24h');

  useEffect(() => {
    const siteId = searchParams.get('site') || 'test-site-id';
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stats?site_id=${siteId}&range=${range}`);
        const json = await res.json();

        // Aggregate topPages and topReferrers from hourly stats
        const topPagesMap: Record<string, number> = {};
        const topReferrersMap: Record<string, number> = {};
        
        (json.hourly || []).forEach((h: any) => {
          const pages = typeof h.topPages === 'string' ? JSON.parse(h.topPages) : (h.topPages || []);
          pages.forEach((p: any) => { topPagesMap[p.url] = (topPagesMap[p.url] || 0) + p.count; });
          
          const refs = typeof h.topReferrers === 'string' ? JSON.parse(h.topReferrers) : (h.topReferrers || []);
          refs.forEach((r: any) => { topReferrersMap[r.referrer] = (topReferrersMap[r.referrer] || 0) + r.count; });
        });

        const topPages = Object.entries(topPagesMap)
          .map(([url, views]) => ({ url, views }))
          .sort((a, b) => b.views - a.views).slice(0, 5);
        const topReferrers = Object.entries(topReferrersMap)
          .map(([referrer, views]) => ({ referrer, views }))
          .sort((a, b) => b.views - a.views).slice(0, 5);

        setData({
          hourly: json.hourly || [],
          summary: { ...json.summary, topPages, topReferrers }
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [range]);

  return (
    <div className="w-full flex flex-col min-h-full">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono uppercase tracking-wider">Time Window</span>
        </div>
        <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#333] rounded-lg p-1">
          {TIME_RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${
                range === r.value
                  ? 'bg-crimson-bright/20 text-crimson-bright border border-crimson-bright/40 shadow-[0_0_12px_rgba(220,38,38,0.15)]'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1">
        
        {/* Left Column: Live Feed */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
          <div className="h-10 bg-obsidian-light/80 rounded-lg border border-[#333] flex items-center px-4 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-3" />
            <span className="text-xs font-mono font-bold text-zinc-300 tracking-wider">LIVE TELEMETRY</span>
          </div>
          <div className="flex-1 bg-obsidian-light/50 backdrop-blur-md rounded-2xl border border-[#333] p-3 min-h-[400px]">
            <LiveFeed />
          </div>
        </div>

        {/* Center Column: Charts */}
        <div className="col-span-12 xl:col-span-6 flex flex-col gap-6">
          {loading ? (
            <div className="h-72 bg-obsidian-light/50 rounded-2xl border border-[#333] animate-pulse flex items-center justify-center">
              <span className="text-xs text-zinc-600 font-mono uppercase tracking-widest animate-pulse">Loading {range} data...</span>
            </div>
          ) : (
            data && <OverviewCharts data={data.hourly} summary={data.summary} />
          )}
        </div>

        {/* Right Column: AI Signals */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-4">
          <SignalCards />
        </div>
      </div>

      {/* Core Conversion Funnel */}
      <div className="mt-8 bg-obsidian-light/40 backdrop-blur-sm rounded-xl border border-[#333] p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-crimson-bright" />
          <span className="font-semibold text-white tracking-wide">Core Conversion Funnel</span>
        </div>
        
        {/* Progress bar stepped viz structure */}
        <div className="flex items-center w-full gap-2 relative">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[#222] -z-10" />
          
          <div className="flex flex-col items-center flex-1">
            <div className="text-lg font-bold text-white bg-obsidian px-2">1,200</div>
            <div className="w-full flex items-center gap-2">
              <div className="h-3 flex-1 bg-[#222] rounded-l-full overflow-hidden">
                <div className="w-full h-full bg-blue-600" />
              </div>
              <div className="px-2 py-1 text-[10px] font-bold bg-zinc-800 text-zinc-400 rounded">100%</div>
            </div>
            <div className="text-xs text-zinc-500 mt-2">Visited Homepage</div>
          </div>

          <div className="flex flex-col items-center flex-1">
            <div className="text-lg font-bold text-white bg-obsidian px-2">840</div>
            <div className="w-full flex items-center gap-2">
              <div className="h-3 flex-1 bg-[#222] overflow-hidden">
                <div className="w-[70%] h-full bg-green-500" />
              </div>
              <div className="px-2 py-1 text-[10px] font-bold bg-green-950 text-green-400 border border-green-900 rounded">70.0%</div>
            </div>
            <div className="text-xs text-zinc-500 mt-2">Viewed Pricing</div>
          </div>

          <div className="flex flex-col items-center flex-1">
            <div className="text-lg font-bold text-white bg-obsidian px-2">210</div>
            <div className="w-full flex items-center gap-2">
              <div className="h-3 flex-1 bg-[#222] rounded-r-full overflow-hidden">
                <div className="w-[25%] h-full bg-yellow-500" />
              </div>
              <div className="px-2 py-1 text-[10px] font-bold bg-yellow-950 text-yellow-500 border border-yellow-900 rounded">25.0%</div>
            </div>
            <div className="text-xs text-zinc-500 mt-2">Completed Checkout</div>
          </div>

        </div>
      </div>
    </div>
  );
}
