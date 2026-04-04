'use client';

import { useState } from 'react';
import { Globe, Key, ArrowRight } from 'lucide-react';

export default function SetupPage() {
  const [domain, setDomain] = useState('');
  const [siteId, setSiteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      const data = await res.json();
      if (data.site) {
        setSiteId(data.site.id);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto mt-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-serif italic text-white mb-3">Target Registration</h1>
        <p className="text-zinc-400 max-w-lg mx-auto">
          Register a new domain to generate a unique <span className="text-crimson-bright font-mono text-sm px-1">site_id</span> for the Collector Script.
        </p>
      </div>

      <div className="bg-obsidian/80 backdrop-blur-xl border border-[#333] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-crimson-bright to-transparent opacity-50" />
        
        {!siteId ? (
          <form onSubmit={handleRegister} className="space-y-6 max-w-md mx-auto">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-zinc-500 mb-2 uppercase flex items-center gap-2">
                <Globe className="w-4 h-4" /> Domain Name
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. example.com"
                className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-crimson-bright focus:ring-1 focus:ring-crimson-bright transition-all font-mono"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-crimson-bright hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Site ID'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="max-w-lg mx-auto space-y-8">
            <div className="p-6 rounded-xl border border-green-900/50 bg-green-950/20 text-center">
              <div className="w-12 h-12 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                <Key className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Registration Complete</h3>
              <p className="text-zinc-400 text-sm">Your domain is now tracked by Insight-OS.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-zinc-500 mb-2 uppercase">Your Site ID</label>
              <div className="bg-[#111] border border-[#333] rounded-lg p-4 font-mono text-crimson-bright text-lg text-center tracking-wider">
                {siteId}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-zinc-500 mb-2 uppercase">Injection Script</label>
              <pre className="bg-[#111] border border-[#333] p-4 rounded-lg overflow-x-auto text-xs text-zinc-300 font-mono">
{`<script src="https://your-domain.com/tracker.js"></script>
<script>
  window.insightOS = window.insightOS || function(){(insightOS.q=insightOS.q||[]).push(arguments)};
  insightOS('init', '${siteId}');
</script>`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
