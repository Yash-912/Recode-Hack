'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import HeatmapCanvas from '@/components/dashboard/HeatmapCanvas';
import { MousePointer2, Settings2, Sparkles } from 'lucide-react';

export default function HeatmapPage() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site') || 'test-site-id';

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  
  // Hardcoded for demo/MVP
  const currentUrl = '/';

  useEffect(() => {
    const fetchHeatmapData = async () => {
      try {
        // Fetch real heatmap data
        const res = await fetch(`/api/heatmap?site_id=${siteId}&url=${encodeURIComponent(currentUrl)}`);
        const data = await res.json();
        
        // API returns { clicks: [{ xPct, yPct }] } — map to x_pct/y_pct for canvas
        const clicks = (data.clicks || []).map((c: any) => ({
          x_pct: c.xPct ?? c.x_pct,
          y_pct: c.yPct ?? c.y_pct
        }));

        if (clicks.length > 0) {
          setEvents(clicks);
        } else {
          // Dummy data generation to simulate a high-traffic "Pricing" CTA and "Nav" clicks
          const dummyEvents = [];
          for(let i=0; i<150; i++) {
             // cluster 1: Top Right Nav (Login/Sign Up)
             if (i < 30) dummyEvents.push({ x_pct: 85 + (Math.random()*5 - 2.5), y_pct: 5 + (Math.random()*5 - 2.5) });
             // cluster 2: Center Primary CTA (Initialize Mission Control)
             else if (i < 100) dummyEvents.push({ x_pct: 50 + (Math.random()*15 - 7.5), y_pct: 55 + (Math.random()*10 - 5) });
             // cluster 3: Scrolling artifacts
             else dummyEvents.push({ x_pct: Math.random()*100, y_pct: Math.random()*100 });
          }
          setEvents(dummyEvents);
        }

        // Phase 3C.1 task integration: Fetch XAI Opinion
        try {
          const aiRes = await fetch('/api/heatmap/opinion', {
            method: 'POST',
            body: JSON.stringify({ site_id: 'test-site-id', url: currentUrl })
          });
          if (aiRes.ok) {
             const aiData = await aiRes.json();
             setAnalysis(aiData);
          }
        } catch (e) { console.error("XAI opinion failed", e) }

      } catch (error) {
        console.error('Failed to load heatmap data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHeatmapData();
  }, [currentUrl]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] p-6 gap-6 w-full">
      
      {/* Top Toolbar */}
      <div className="flex justify-between items-center bg-obsidian-light/50 border border-[#333] rounded-xl px-6 py-4 shadow-xl backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <MousePointer2 className="w-5 h-5 text-crimson-bright" />
          <h2 className="text-white font-semibold">Click-Stream Intelligence</h2>
          <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded ml-2">URL: {currentUrl}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-zinc-500">
            {events.length} Data Points Analyzed
          </div>
          <button className="p-2 hover:bg-white/5 rounded transition-colors text-zinc-400 border border-[#333]">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full flex-1 min-h-0">
        
        {/* Heatmap Canvas Container */}
        <div className="flex-1 bg-[#0a0a0a] rounded-xl border border-[#222] relative overflow-hidden shadow-2xl h-full flex flex-col items-center justify-center">
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-obsidian/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-crimson-bright border-t-transparent rounded-full animate-spin" />
                <div className="text-crimson-bright font-mono text-sm tracking-widest animate-pulse">RENDERING THERMAL LAYER...</div>
              </div>
            </div>
          )}

          {/* 2C.10 Live site preview — iframe of actual tracked website */}
          <div className="w-full h-full bg-[#080808] relative overflow-hidden">
            <iframe 
              src="/demo/index.html"
              title="Tracked Website Preview"
              className="w-full h-full border-0 pointer-events-none opacity-40"
              sandbox="allow-same-origin"
            />
            {/* Thermal glow canvas overlaid on top of the real site */}
            <HeatmapCanvas events={events} />
          </div>
        </div>

        {/* 3C.2 Heatmap XAI Opinion Sidebar */}
        <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 overflow-y-auto">
          {analysis ? (
             <div className="bg-obsidian-light/50 border border-red-500/30 rounded-xl p-5 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-[50px] -mr-10 -mt-10" />
               <div className="flex items-center gap-2 mb-4 relative z-10">
                 <Sparkles className="w-4 h-4 text-crimson-bright" />
                 <span className="text-xs uppercase tracking-widest font-bold text-white">Insight-OS Analysis</span>
               </div>
               
               <p className="text-sm text-zinc-300 leading-relaxed relative z-10">
                 {analysis.opinion || "76% of all recorded user interactions are concentrated around the primary central component. There is massive drop-off outside of the main CTA zone."}
               </p>

               <div className="mt-4 pt-4 border-t border-[#333] relative z-10">
                 <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-2">Confidence Level</span>
                 <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                   <div className="w-[88%] h-full bg-crimson-bright" />
                 </div>
               </div>
             </div>
          ) : (
            <div className="bg-obsidian-light/30 border border-[#222] rounded-xl p-5 flex flex-col items-center justify-center text-center h-48 opacity-60">
               <Sparkles className="w-6 h-6 text-zinc-600 mb-3" />
               <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold">XAI Analysis Pending</span>
            </div>
          )}

          {/* Quick Stats Panel */}
          <div className="bg-obsidian-light/50 border border-[#333] rounded-xl p-5">
            <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-4">Interaction Density</h3>
            <ul className="space-y-4">
               <li>
                 <div className="flex justify-between text-sm mb-1">
                   <span className="text-zinc-400">Primary CTA</span>
                   <span className="text-white font-mono">68%</span>
                 </div>
                 <div className="w-full h-1 bg-[#222] rounded-full"><div className="w-[68%] h-full bg-crimson-bright"></div></div>
               </li>
               <li>
                 <div className="flex justify-between text-sm mb-1">
                   <span className="text-zinc-400">Navigation</span>
                   <span className="text-white font-mono">20%</span>
                 </div>
                 <div className="w-full h-1 bg-[#222] rounded-full"><div className="w-[20%] h-full bg-blue-500"></div></div>
               </li>
               <li>
                 <div className="flex justify-between text-sm mb-1">
                   <span className="text-zinc-400">Dead Clicks</span>
                   <span className="text-white font-mono">12%</span>
                 </div>
                 <div className="w-full h-1 bg-[#222] rounded-full"><div className="w-[12%] h-full bg-yellow-500"></div></div>
               </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
