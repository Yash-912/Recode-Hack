'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Brain, Target, AlertTriangle, RefreshCw } from 'lucide-react';

export default function SignalCards() {
  const searchParams = useSearchParams();
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = async () => {
    setLoading(true);
    const siteId = searchParams.get('site') || 'test-site-id';
    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId })
      });
      const data = await res.json();
      setSignals(data.signals || []);
    } catch (error) {
      console.error("Failed to fetch signals", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-crimson-bright" />
            AI Signals
          </h3>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-xl bg-[#111] animate-pulse border border-[#222]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold flex items-center gap-2">
          <Brain className="w-4 h-4 text-crimson-bright" />
          AI Signals
        </h3>
        <button 
          onClick={fetchSignals}
          className="p-1.5 hover:bg-[#222] rounded-md transition-colors text-zinc-500 hover:text-white"
          title="Regenerate Signals"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {signals.length === 0 ? (
        <div className="p-6 rounded-xl border border-[#333] bg-obsidian-light/50 text-center">
          <Brain className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <div className="text-zinc-400 text-sm">No signals detected right now.</div>
        </div>
      ) : (
        signals.map((signal, idx) => {
          let borderColor = 'border-[#333]';
          let badgeColor = 'bg-zinc-800 text-zinc-300';
          let Icon = Target;
          
          if (signal.severity === 'critical') {
            borderColor = 'border-red-500/50';
            badgeColor = 'bg-red-950/80 text-red-400 border border-red-900';
            Icon = AlertCircle;
          } else if (signal.severity === 'warning') {
            borderColor = 'border-yellow-500/50';
            badgeColor = 'bg-yellow-950/80 text-yellow-400 border border-yellow-900';
            Icon = AlertTriangle;
          } else if (signal.severity === 'info') {
            borderColor = 'border-blue-500/50';
            badgeColor = 'bg-blue-950/80 text-blue-400 border border-blue-900';
          }

          return (
            <div key={idx} className={`bg-[#0a0a0a] p-5 rounded-xl border-l-4 ${borderColor} border-y border-y-[#222] border-r border-r-[#222] shadow-lg relative overflow-hidden group`}>
              <div className={`absolute top-4 right-4 px-2 py-0.5 text-[10px] uppercase font-bold rounded ${badgeColor}`}>
                {signal.confidence ?? '—'}%
              </div>

              <h4 className="text-base text-white font-semibold pr-16 flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 opacity-80 shrink-0" />
                {signal.title || 'Signal Detected'}
              </h4>
              
              <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                {signal.body || signal.narrative || signal.description || signal.message || 'No description provided by AI.'}
              </p>

              {/* XAI Evidence Chain */}
              {signal.reasoning && (
                 <div className="mt-3 pt-3 border-t border-[#222]">
                   <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold mb-1">AI Reasoning</div>
                   <p className="text-xs text-zinc-500 leading-relaxed">{signal.reasoning}</p>
                 </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
