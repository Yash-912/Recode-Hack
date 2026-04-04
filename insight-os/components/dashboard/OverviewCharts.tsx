'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, MousePointerClick, Globe } from 'lucide-react';

// Custom Tooltip for the Area Chart with Glassmorphism
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#050505]/90 border border-[#333] shadow-2xl backdrop-blur-md rounded-xl p-4">
        <p className="text-zinc-400 text-xs uppercase tracking-widest font-semibold mb-3">{label}</p>
        {payload.map((p: any, idx: number) => (
          <div key={idx} className="flex items-center gap-3 mb-2 last:mb-0">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <p className="text-white font-medium text-sm">
              {p.name === 'pageviews' ? 'Pageviews' : 'Clicks'}
            </p>
            <p className="text-white font-bold ml-auto">{p.value}</p>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Bar Charts
const BarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#050505]/95 border border-[#444] rounded-lg py-2 px-3 shadow-xl backdrop-blur-md">
        <p className="text-zinc-300 text-xs">
          <span className="text-white font-bold">{payload[0].value}</span> views
        </p>
      </div>
    );
  }
  return null;
};

export default function OverviewCharts({ data, summary }: { data: any[], summary: any }) {

  const spikes = useMemo(() => {
    if (!data || data.length === 0) return [];
    const avg = data.reduce((sum, d) => sum + d.pageviews, 0) / data.length;
    const threshold = avg * 2;
    return data.filter(d => d.pageviews > threshold && d.pageviews > 10).map(d => d.hour);
  }, [data]);

  const formattedData = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({
      ...d,
      hourLabel: new Date(d.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
  }, [data]);

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Annotated Area Chart */}
      <div className="bg-[#0a0a0a]/60 border border-[#222] rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-sm relative overflow-hidden group">
        
        {/* Subtle background glow effect */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-[120px] pointer-events-none transition-opacity duration-1000 group-hover:opacity-100 opacity-50" />
        
        <div className="flex justify-between items-end mb-6 relative z-10">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-crimson-bright" />
              Traffic Velocity
            </h3>
            <p className="text-sm text-zinc-500 mt-1 font-mono uppercase tracking-widest">Trailing 24 hours</p>
          </div>
        </div>
        
        <div className="h-[320px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorClick" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="hourLabel" stroke="#555" fontSize={11} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#555" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
              
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333', strokeWidth: 1, strokeDasharray: '4 4' }} />
              
              {spikes.map(spike => (
                <ReferenceLine 
                  key={spike} 
                  x={new Date(spike).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                  stroke="#ef4444" 
                  strokeDasharray="4 4" 
                  label={{ position: 'top', value: '🔥 SPIKE', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }}
                />
              ))}

              <Area 
                type="monotone" 
                dataKey="clicks" 
                stroke="#3B82F6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorClick)" 
                activeDot={{ r: 4, fill: '#3b82f6', stroke: '#000', strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="pageviews" 
                stroke="#ef4444" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorPv)" 
                activeDot={{ r: 6, fill: '#ef4444', stroke: '#0a0a0a', strokeWidth: 3 }}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className="bg-[#0a0a0a]/60 border border-[#222] rounded-2xl p-6 shadow-xl backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-red-900/5 rounded-full blur-[80px] pointer-events-none" />
          <h3 className="text-xs font-semibold text-white mb-6 uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Globe className="w-4 h-4 text-zinc-500" />
            Top Pages
          </h3>
          <div className="h-56">
            {summary?.topPages && summary.topPages.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.topPages} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="url" stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip content={<BarTooltip />} cursor={{fill: '#111'}} />
                  <Bar dataKey="views" radius={[0, 4, 4, 0]} barSize={20} animationDuration={1000}>
                    {summary.topPages.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={`rgba(220, 38, 38, ${1 - index * 0.15})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-zinc-600 text-sm flex items-center justify-center h-full">No trajectory data yet</div>
            )}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="bg-[#0a0a0a]/60 border border-[#222] rounded-2xl p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-900/5 rounded-full blur-[80px] pointer-events-none" />
          <h3 className="text-xs font-semibold text-white mb-6 uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-zinc-500" />
            Top Referrers
          </h3>
          <div className="h-56">
            {summary?.topReferrers && summary.topReferrers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.topReferrers} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="referrer" stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip content={<BarTooltip />} cursor={{fill: '#111'}} />
                  <Bar dataKey="views" radius={[0, 4, 4, 0]} barSize={20} animationDuration={1200}>
                    {summary.topReferrers.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={`rgba(59, 130, 246, ${1 - index * 0.15})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-zinc-600 text-sm flex items-center justify-center h-full">No trajectory data yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
