'use client';

import dynamic from 'next/dynamic';

// We must dynamically import Leaflet components because they rely on the `window` object,
// which causes errors during Next.js Server-Side Rendering (SSR).
const LiveGeoMap = dynamic(() => import('@/components/dashboard/LiveGeoMap'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-140px)] w-full items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-crimson-bright border-t-transparent animate-spin" />
        <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest animate-pulse">
          Booting Live Map Engine...
        </div>
      </div>
    </div>
  )
});

export default function Page() {
  return <LiveGeoMap />;
}
