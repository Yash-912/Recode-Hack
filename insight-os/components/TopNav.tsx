'use client';

import { Activity, Globe2, Eye, LayoutDashboard, Funnel, Flame, Users, Map, Server } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState, useEffect } from 'react';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [sites, setSites] = useState<{id:string,domain:string}[]>([]);
  const [stats, setStats] = useState({
    activeNow: '--',
    todayPVs: '--',
    topCountry: '--'
  });

  const tabs = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Funnels', path: '/dashboard/funnels', icon: Funnel },
    { name: 'Heatmap', path: '/dashboard/heatmap', icon: Flame },
    { name: 'Sessions', path: '/dashboard/sessions', icon: Users },
    { name: 'Live Map', path: '/dashboard/map', icon: Map },
    { name: 'Endpoints', path: '/dashboard/sites', icon: Server },
  ];

  useEffect(() => {
    const activeSiteId = searchParams.get('site') || 'test-site-id';
    
    const fetchData = async () => {
      try {
        const [statsRes, activeRes, sitesRes] = await Promise.all([
          fetch(`/api/stats?site_id=${activeSiteId}`),
          fetch(`/api/active-locations?site_id=${activeSiteId}`),
          fetch('/api/sites')
        ]);
        
        const statsData = await statsRes.json();
        const activeData = await activeRes.json();
        const sitesData = await sitesRes.json();

        setSites(sitesData);

        if (statsData.summary) {
          setStats({
            activeNow: (activeData.locations?.length || 0).toString(),
            todayPVs: statsData.summary.pageviews.toString(),
            topCountry: 'US' // Placeholder
          });
        }
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [searchParams]);

  return (
    <div className="flex flex-col border-b border-[#222] bg-obsidian/60 backdrop-blur-xl sticky top-0 z-50">
      {/* Top Stats Bar */}
      <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4">
        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
          {/* Active Now */}
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-[#111] border border-[#333] shadow-inner">
            <div className="w-2 h-2 rounded-full bg-crimson-bright animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
            <div className="text-[10px] md:text-xs text-zinc-400 uppercase tracking-wider font-semibold">Active Now</div>
            <div className="text-base md:text-xl font-bold text-white ml-1 md:ml-2">{stats.activeNow}</div>
          </div>

          {/* Today's PVs */}
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-[#111] border border-[#333] shadow-inner">
            <Eye className="w-3.5 md:w-4 h-3.5 md:h-4 text-zinc-500" />
            <div className="text-[10px] md:text-xs text-zinc-400 uppercase tracking-wider font-semibold">Today&apos;s PVs</div>
            <div className="text-sm md:text-lg font-bold text-white ml-1 md:ml-2">{stats.todayPVs}</div>
          </div>

          {/* Top Country */}
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-[#111] border border-[#333] shadow-inner">
            <Globe2 className="w-3.5 md:w-4 h-3.5 md:h-4 text-zinc-500" />
            <div className="text-[10px] md:text-xs text-zinc-400 uppercase tracking-wider font-semibold">Top Country</div>
            <div className="text-sm md:text-lg font-bold text-white ml-1 md:ml-2">{stats.topCountry}</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <select 
            className="bg-black border border-zinc-800 text-white rounded p-1.5 text-xs font-mono outline-none focus:border-red-500"
            value={searchParams.get('site') || 'test-site-id'}
            onChange={(e) => router.push('?site=' + e.target.value)}
          >
            <option value="test-site-id">test-site-id</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.domain}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Navigation — horizontal scroll on mobile */}
      <div className="flex px-4 md:px-8 gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path || (tab.path !== '/dashboard' && pathname.startsWith(tab.path));
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.name}
              onClick={() => {
                const currentSite = searchParams.get('site');
                const queryString = currentSite ? `?site=${currentSite}` : '';
                router.push(`${tab.path}${queryString}`);
              }}
              className={cn(
                "flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 border-b-2 text-xs md:text-sm font-semibold transition-colors duration-200 whitespace-nowrap flex-shrink-0",
                isActive 
                  ? "border-crimson-bright text-white bg-red-950/20" 
                  : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-crimson-bright" : "text-zinc-500")} />
              <span className="hidden sm:inline">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
