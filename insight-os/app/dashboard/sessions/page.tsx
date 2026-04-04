'use client';

import { useState, useEffect } from 'react';
import { Users, Monitor, Smartphone, Globe2, ChevronDown, ChevronUp, Sparkles, Loader2, Eye, MousePointer2, CheckCircle, XCircle } from 'lucide-react';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [narratives, setNarratives] = useState<Record<string, string>>({});
  const [loadingNarrative, setLoadingNarrative] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/sessions?site_id=test-site-id');
        const data = await res.json();
        console.log('Sessions API response:', data);
        setSessions(data.sessions || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchSessions();
  }, []);

  const toggleSession = async (sessionHash: string) => {
    if (expandedSession === sessionHash) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(sessionHash);

    // Fetch AI narrative if not already loaded
    if (!narratives[sessionHash]) {
      setLoadingNarrative(sessionHash);
      try {
        const res = await fetch('/api/narratives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_hash: sessionHash, site_id: 'test-site-id' })
        });
        const data = await res.json();
        setNarratives(prev => ({ ...prev, [sessionHash]: data.narrative || 'No narrative available.' }));
      } catch (e) {
        setNarratives(prev => ({ ...prev, [sessionHash]: 'Failed to generate narrative.' }));
      } finally {
        setLoadingNarrative(null);
      }
    }
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 bg-[#111] animate-pulse rounded-xl border border-[#1a1a1a]" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 w-full">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-crimson-bright" />
          Session Explorer
        </h2>
        <p className="text-sm text-zinc-500 mt-1">Click any session to get an AI-generated narrative of the user&apos;s journey</p>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-[#333] rounded-xl">
          No sessions recorded yet. Generate traffic on the demo site first.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session: any) => {
            const isExpanded = expandedSession === session.sessionHash;

            return (
              <div key={session.sessionHash} className="bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden">
                {/* Session Header */}
                <button
                  onClick={() => toggleSession(session.sessionHash)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Device */}
                    <div className="w-9 h-9 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center">
                      {session.device === 'mobile'
                        ? <Smartphone className="w-4 h-4 text-blue-400" />
                        : <Monitor className="w-4 h-4 text-zinc-400" />
                      }
                    </div>
                    <div className="text-left">
                      <div className="text-sm text-white font-mono">
                        {session.sessionHash?.substring(0, 12)}...
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                        <Eye className="w-3 h-3" />
                        <span>{session.pageviews ?? 0} views</span>
                        <span>·</span>
                        <MousePointer2 className="w-3 h-3" />
                        <span>{session.clicks ?? 0} clicks</span>
                        <span>·</span>
                        <Globe2 className="w-3 h-3" />
                        <span>{session.country || '??'}</span>
                        <span>·</span>
                        <span>{session.device}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Conversion badge */}
                    {session.converted ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-green-950 text-green-400 border border-green-900 px-2 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" /> Converted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded">
                        <XCircle className="w-3 h-3" /> Dropped
                      </span>
                    )}
                    <span className="text-xs text-zinc-600">{session.firstEvent ? timeAgo(session.firstEvent) : ''}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                </button>

                {/* Expanded: Journey + AI Narrative */}
                {isExpanded && (
                  <div className="border-t border-[#1a1a1a] p-4">
                    {/* Page Journey */}
                    <div className="mb-4">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-2">Page Journey</div>
                      <div className="flex flex-col gap-1">
                        {(session.pages || []).map((page: string, i: number) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <div className="w-5 h-5 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-[10px] text-zinc-500 font-mono">{i + 1}</div>
                            <div className="h-px flex-1 bg-[#222]" />
                            <span className="text-zinc-300 font-mono">{page}</span>
                          </div>
                        ))}
                      </div>
                      {(!session.pages || session.pages.length === 0) && (
                        <div className="text-xs text-zinc-600">No page journey data available</div>
                      )}
                    </div>

                    {/* Session Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-white">{session.totalEvents ?? 0}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Total Events</div>
                      </div>
                      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-white">{session.pageviews ?? 0}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Pageviews</div>
                      </div>
                      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-white">{session.clicks ?? 0}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Clicks</div>
                      </div>
                    </div>

                    {/* AI Narrative */}
                    <div className="bg-[#111] border border-[#222] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-crimson-bright" />
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">AI Session Narrative</span>
                      </div>
                      {loadingNarrative === session.sessionHash ? (
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Generating narrative...
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-300 leading-relaxed">
                          {narratives[session.sessionHash] || 'Click to generate narrative...'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
