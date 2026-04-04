import { CheckCircle2, Lock, ShieldAlert } from 'lucide-react';

export default function PhaseTracker() {
  const phases = [
    { name: 'Phase 1: The Collector', status: 'active', desc: 'Data Ingestion & Event Tracking' },
    { name: 'Phase 2: Funnel Engine', status: 'active', desc: 'Conversion Analysis & Core Features' },
    { name: 'Phase 3: AI & The Wow Factors', status: 'locked', desc: 'Explainable AI Insights & Heatmaps' },
  ];

  return (
    <div className="w-64 flex flex-col p-6 border-r border-[#222] bg-obsidian-light/30 backdrop-blur-md hidden md:flex shrink-0">
      <div className="mb-10">
        <h2 className="font-serif italic text-2xl tracking-tight text-white mb-1">
          Insight<span className="text-crimson-bright font-sans not-italic font-black text-xl tracking-normal">OS</span>
        </h2>
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4">Mission Control</div>
        <div className="flex gap-2">
          <span className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded border border-zinc-800 bg-zinc-900/50 text-zinc-400">Next.js 14</span>
          <span className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded border border-blue-900/40 bg-blue-900/20 text-blue-400">TypeScript</span>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <h3 className="text-xs uppercase tracking-widest text-zinc-600 font-semibold mb-4">Deployment Phases</h3>
        
        <div className="space-y-6 relative">
          {/* Connecting line */}
          <div className="absolute left-3.5 top-4 bottom-4 w-px bg-gradient-to-b from-crimson-bright via-crimson to-[#222] z-0" />

          {phases.map((phase, idx) => {
            const isActive = phase.status === 'active';
            
            return (
              <div key={idx} className={`relative z-10 flex gap-4 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`mt-1 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 
                  ${isActive 
                    ? 'bg-crimson border-crimson-bright text-crimson-bright shadow-[0_0_15px_rgba(220,38,38,0.4)]' 
                    : 'bg-obsidian border-[#333] text-zinc-500 backdrop-blur-xl'}`}
                >
                  {isActive ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                    {phase.name}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">{phase.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 p-4 rounded-xl border border-red-900/30 bg-red-950/10 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-crimson-bright shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-semibold text-red-200 uppercase tracking-wider mb-1">System Status</div>
          <div className="text-[10px] text-zinc-400 leading-relaxed">
            AI Nodes are waiting for initial telemetry override. Please complete Phase 3 to unlock full dashboard capability.
          </div>
        </div>
      </div>
    </div>
  );
}
