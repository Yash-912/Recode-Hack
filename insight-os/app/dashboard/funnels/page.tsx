'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Trash2, Activity, ChevronRight } from 'lucide-react';

export default function FunnelsPage() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site') || 'test-site-id';
  
  const [funnels, setFunnels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('Checkout Flow');
  const [newSteps, setNewSteps] = useState<string[]>(['/demo/index.html', '/demo/pricing.html', '/demo/checkout.html', '/demo/thank-you.html']);
  const [selectedFunnel, setSelectedFunnel] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any[]>([]);
  const [error, setError] = useState('');

  // Fetch all funnels
  useEffect(() => {
    fetchFunnels();
  }, [siteId]);

  const fetchFunnels = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/funnels?site_id=${siteId}`);
      const data = await res.json();
      setFunnels(data.funnels || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Create funnel
  const handleCreate = async () => {
    if (!newName.trim()) { setError('Please enter a funnel name'); return; }
    if (newSteps.filter(s => s.trim()).length < 2) { setError('Add at least 2 URL steps'); return; }
    setError('');
    try {
      await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          name: newName,
          steps: newSteps.filter(s => s)
        })
      });
      setShowCreate(false);
      setNewName('');
      setNewSteps(['/', '']);
      fetchFunnels();
    } catch (e) { console.error(e); }
  };

  const [markov, setMarkov] = useState<any[]>([]);

  // Fetch analysis for a funnel
  const loadAnalysis = async (funnel: any) => {
    setSelectedFunnel(funnel);
    setAnalysis([]);
    setMarkov([]);
    try {
      const res = await fetch(`/api/funnels/${funnel.id}/analysis?site_id=${siteId}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      console.log('Funnel analysis response:', data);
      setAnalysis(data.analysis || data.steps || []);
      setMarkov(data.transitionProbabilities || []);
    } catch (e) { console.error('Funnel analysis error:', e); }
  };

  const getDropColor = (pct: number) => {
    if (pct >= 60) return { bar: 'bg-green-500', badge: 'bg-green-950 text-green-400 border-green-900' };
    if (pct >= 30) return { bar: 'bg-yellow-500', badge: 'bg-yellow-950 text-yellow-400 border-yellow-900' };
    return { bar: 'bg-red-500', badge: 'bg-red-950 text-red-400 border-red-900' };
  };

  return (
    <div className="p-6 flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-crimson-bright" />
            Conversion Funnels
          </h2>
          <p className="text-sm text-zinc-500 mt-1">Track multi-step user journeys and identify drop-off points</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-crimson-bright/20 border border-crimson-bright/40 text-crimson-bright rounded-lg text-sm font-semibold hover:bg-crimson-bright/30 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Funnel
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Define Funnel Steps</h3>
          {error && <div className="text-red-400 text-xs mb-3 bg-red-950/30 border border-red-900 px-3 py-2 rounded">{error}</div>}
          <input
            value={newName}
            onChange={e => { setNewName(e.target.value); setError(''); }}
            placeholder="Funnel name (e.g. Checkout Flow)"
            className={`w-full bg-[#111] border px-4 py-2 rounded-lg text-white text-sm mb-4 focus:border-crimson-bright outline-none ${error && !newName.trim() ? 'border-red-500' : 'border-[#333]'}`}
          />
          {newSteps.map((step, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <span className="text-xs text-zinc-500 w-16 pt-2.5 shrink-0">Step {i + 1}</span>
              <input
                value={step}
                onChange={e => {
                  const updated = [...newSteps];
                  updated[i] = e.target.value;
                  setNewSteps(updated);
                }}
                placeholder="/page-url"
                className="flex-1 bg-[#111] border border-[#222] px-3 py-2 rounded text-white text-sm font-mono focus:border-crimson-bright outline-none"
              />
              {newSteps.length > 2 && (
                <button onClick={() => setNewSteps(newSteps.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-3 mt-4">
            <button onClick={() => setNewSteps([...newSteps, ''])} className="text-xs text-zinc-400 hover:text-white border border-[#333] px-3 py-1.5 rounded">
              + Add Step
            </button>
            <button onClick={handleCreate} className="text-xs bg-crimson-bright text-white px-4 py-1.5 rounded font-semibold hover:bg-red-700 transition-colors">
              Create Funnel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Funnel List */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          {loading ? (
            [1, 2].map(i => <div key={i} className="h-20 bg-[#111] animate-pulse rounded-xl border border-[#1a1a1a]" />)
          ) : funnels.length === 0 ? (
            <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-[#333] rounded-xl">
              No funnels defined yet. Create one above.
            </div>
          ) : (
            funnels.map(f => (
              <button
                key={f.id}
                onClick={() => loadAnalysis(f)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  selectedFunnel?.id === f.id
                    ? 'bg-red-950/20 border-crimson-bright/40'
                    : 'bg-[#0a0a0a] border-[#222] hover:border-[#444]'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold text-sm">{f.name}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">
                  {(typeof f.steps === 'string' ? JSON.parse(f.steps) : f.steps || []).length} steps
                </div>
              </button>
            ))
          )}
        </div>

        {/* Analysis Visualization */}
        <div className="col-span-12 lg:col-span-8">
          {selectedFunnel && analysis.length > 0 ? (
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6">
              <h3 className="text-white font-semibold mb-6">{selectedFunnel.name} — Drop-off Analysis</h3>
              <div className="flex flex-col gap-4">
                {analysis.map((step: any, idx: number) => {
                  const pct = step.sessions && analysis[0].sessions 
                    ? Math.round((step.sessions / analysis[0].sessions) * 100) 
                    : 0;
                  const colors = getDropColor(pct);
                  return (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-6">#{idx + 1}</span>
                          <span className="text-sm text-white font-mono">{step.url}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white font-bold">{step.sessions ?? 0}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${colors.badge}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div className={`h-full ${colors.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                      {idx < analysis.length - 1 && (
                        <div className="flex gap-4 mt-1 ml-8">
                          {step.drop_pct !== undefined && (
                            <span className="text-[10px] text-red-400">
                              ↓ {step.drop_pct}% overall drop
                            </span>
                          )}
                          {markov[idx] && (
                            <span className="text-[10px] text-blue-400 font-mono">
                              (Markov: {markov[idx].probabilityPct}% direct to next step)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 border border-dashed border-[#333] rounded-xl text-zinc-600 text-sm">
              Select a funnel to view drop-off analysis
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
