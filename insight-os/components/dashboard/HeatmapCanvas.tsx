'use client';

import { useEffect, useRef, useState } from 'react';

interface HeatmapEvent {
  x_pct: number;
  y_pct: number;
  count: number; // In case we aggregate, but usually it's just individual clicks
}

export default function HeatmapCanvas({ events }: { events: HeatmapEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; count: number; freq: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set up high-res canvas
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // 2C.11 The Click-stream Overlay: Thermal glowing red/orange hues
    ctx.globalCompositeOperation = 'screen';
    
    events.forEach(event => {
      const x = (event.x_pct / 100) * rect.width;
      const y = (event.y_pct / 100) * rect.height;
      
      const radius = 50; // Tighter physical glow radius
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      
      // Thermal colors: Blood red core -> orange -> transparent
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');       // Deep crimson hot
      gradient.addColorStop(0.3, 'rgba(255, 100, 0, 0.4)');   // Orange/amber
      gradient.addColorStop(0.7, 'rgba(255, 160, 0, 0.1)');   // Yellow fade
      gradient.addColorStop(1, 'rgba(255, 160, 0, 0)');
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
    
  }, [events]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickXPct = (e.nativeEvent.offsetX / rect.width) * 100;
    const clickYPct = (e.nativeEvent.offsetY / rect.height) * 100;

    // Scan for all events within a generous 5% Euclidean radial distance
    let localCount = 0;
    events.forEach(event => {
      const dx = event.x_pct - clickXPct;
      const dy = event.y_pct - clickYPct;
      if (Math.sqrt(dx * dx + dy * dy) <= 5.0) {
        localCount++;
      }
    });

    const frequency = ((localCount / Math.max(1, events.length)) * 100).toFixed(1);

    setTooltip({
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
      count: localCount,
      freq: frequency
    });

    // Auto-hide tooltip after 3 seconds
    setTimeout(() => setTooltip(null), 3500);
  };

  return (
    <>
      <canvas 
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="absolute inset-0 w-full h-full cursor-crosshair z-10 opacity-90"
        style={{ mixBlendMode: 'screen' }}
      />
      {tooltip && (
        <div 
          className="fixed z-50 bg-black/90 border border-zinc-800 text-white text-xs p-3 rounded-lg shadow-xl shadow-black/50 backdrop-blur-sm transform -translate-x-1/2 -translate-y-[120%]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold text-red-500 mb-1">LOCAL CLUSTER</div>
          <div>Clicks Recorded: <span className="text-zinc-300 font-mono">{tooltip.count}</span></div>
          <div>Density Map (%): <span className="text-zinc-300 font-mono">{tooltip.freq}% of total grid</span></div>
        </div>
      )}
    </>
  );
}
