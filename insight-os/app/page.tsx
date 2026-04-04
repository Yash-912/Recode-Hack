'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Code2, Database, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-obsidian overflow-hidden font-sans selection:bg-crimson-bright selection:text-white flex flex-col">
      
      {/* ─── BACKGROUND FX ────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        {/* Massive Crimson Center Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-red-900/40 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Concentric Pulse Rings (Bottom) */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none perspective-[1000px]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.1, 0.5, 0.1], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transform: 'rotateX(75deg)' }}
            className="absolute inset-0 rounded-[100%] border border-red-600/40 shadow-[0_0_30px_rgba(220,38,38,0.3)]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.05, 0.3, 0.05], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            style={{ transform: 'rotateX(75deg)' }}
            className="absolute -inset-10 rounded-[100%] border border-red-600/20"
          />
        </div>
      </div>

      {/* ─── HEADER MINIMAL NAV ───────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-10 py-6 border-b border-white/5 bg-obsidian/40 backdrop-blur-md">
        <div className="font-serif italic text-2xl tracking-tight text-white">
          Insight<span className="text-crimson-bright font-sans not-italic font-black text-xl tracking-normal">OS</span>
        </div>
        <div className="flex gap-4">
          <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur text-xs font-semibold tracking-wider text-zinc-300">
            Next.js 14
          </div>
          <div className="px-3 py-1.5 rounded-full bg-blue-900/20 border border-blue-500/20 backdrop-blur text-xs font-semibold tracking-wider text-blue-400">
            TypeScript
          </div>
        </div>
      </header>

      {/* ─── HERO CONTENT (SCROLL ANIMATION) ──────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start w-full">
        
        <ContainerScroll
          titleComponent={
            <div className="text-center w-full px-6 mb-8 mt-4 md:mt-8">
              <h1 className="text-5xl md:text-7xl font-sans font-medium text-white mb-6 leading-tight tracking-tight">
                Analytics shows events.<br/>
                <span className="font-serif italic font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-crimson-bright to-red-600 block mt-2">
                  Insight-OS shows meaning.
                </span>
              </h1>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
                Privacy-first event tracking, real-time funnel analysis, and Explainable AI (XAI) that audits your click-streams to deliver actionable business intelligence.
              </p>

              <button 
                onClick={() => router.push('/login')}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-obsidian rounded-full font-bold text-sm tracking-wide overflow-hidden hover:scale-105 transition-transform"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-crimson-bright to-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10 group-hover:text-white transition-colors">Initialize Mission Control</span>
                <ArrowRight className="w-4 h-4 relative z-10 group-hover:text-white transition-colors transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          }
        >
          <img
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070"
            alt="Dashboard Mockup"
            className="w-full h-full object-cover object-top opacity-80"
            draggable={false}
          />
        </ContainerScroll>

      </main>

      {/* Red Rim Lighting Effect on edges */}
      <div className="pointer-events-none fixed inset-0 border border-crimson-bright/20 shadow-[inset_0_0_100px_rgba(153,27,27,0.15)] z-50 rounded-lg" />
    </div>
  );
}
