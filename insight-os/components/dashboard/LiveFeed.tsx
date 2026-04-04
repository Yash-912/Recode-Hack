'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, MousePointer2, Globe2 } from 'lucide-react';

interface LiveEvent {
  id: string;
  type: string;
  url: string;
  country: string;
  ts: string;
}

export default function LiveFeed() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteId = searchParams.get('site') || 'test-site-id';
    const fetchRecent = async () => {
      try {
        const res = await fetch(`/api/events/recent?site_id=${siteId}`);
        const data = await res.json();
        setEvents(data.events || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchRecent();
    // Poll every 5 seconds for near-real-time feel
    const interval = setInterval(fetchRecent, 5000);
    return () => clearInterval(interval);
  }, [searchParams]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-[#111] animate-pulse rounded-lg border border-[#1a1a1a]" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10">
        <div className="w-3 h-3 rounded-full bg-crimson-bright animate-pulse mb-4 shadow-[0_0_15px_rgba(220,38,38,0.6)]" />
        <div className="text-zinc-500 text-xs uppercase tracking-widest font-semibold">Waiting for events...</div>
        <div className="text-zinc-600 text-[10px] mt-2">Embed tracker.js to start streaming</div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex flex-col gap-1.5 overflow-y-auto max-h-[500px] pr-1">
      {events.map((event, idx) => (
        <div
          key={event.id || idx}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#333] transition-colors group"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          {/* Type Icon */}
          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
            event.type === 'pageview' 
              ? 'bg-blue-950 border border-blue-900' 
              : 'bg-red-950 border border-red-900'
          }`}>
            {event.type === 'pageview' 
              ? <Eye className="w-3.5 h-3.5 text-blue-400" />
              : <MousePointer2 className="w-3.5 h-3.5 text-red-400" />
            }
          </div>

          {/* URL */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-zinc-300 truncate font-mono">{event.url || '/'}</div>
          </div>

          {/* Country */}
          <div className="flex items-center gap-1 shrink-0">
            <Globe2 className="w-3 h-3 text-zinc-600" />
            <span className="text-[10px] text-zinc-500 font-mono">{event.country || '??'}</span>
          </div>

          {/* Time */}
          <div className="text-[10px] text-zinc-600 font-mono shrink-0 w-12 text-right">
            {timeAgo(event.ts)}
          </div>
        </div>
      ))}
    </div>
  );
}
