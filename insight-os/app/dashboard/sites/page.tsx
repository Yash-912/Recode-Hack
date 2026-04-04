'use client';

import { useState, useEffect } from 'react';
import TopNav from '@/components/TopNav';

export default function SitesManager() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedSite, setGeneratedSite] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then(setSites);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/sites', {
      method: 'POST',
      body: JSON.stringify({ domain })
    });
    const data = await res.json();
    setLoading(false);
    
    if (data.error) return alert(data.error);
    setGeneratedSite(data);
    setSites([data, ...sites]);
    setDomain('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans">
      <TopNav />
      <div className="max-w-4xl mx-auto p-8 pt-12 space-y-8">
        
        <div className="bg-[#111] border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl text-white font-bold mb-4">Register New Endpoint</h2>
          <form onSubmit={handleRegister} className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-xs text-zinc-500 font-mono">DOMAIN</label>
              <input required value={domain} onChange={e=>setDomain(e.target.value)} placeholder="e.g. acmecorp.com" className="w-full bg-black border border-zinc-800 p-3 rounded-lg focus:border-red-500 outline-none" />
            </div>
            <button disabled={loading} type="submit" className="bg-red-500 hover:bg-red-600 text-white font-bold p-3 px-6 rounded-lg transition-colors">
              Deploy
            </button>
          </form>
        </div>

        {generatedSite && (
          <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-6 shadow-[0_0_40px_rgba(220,38,38,0.1)]">
            <h2 className="text-xl text-red-500 font-bold mb-2">Endpoint Registered Successfully!</h2>
            <p className="text-sm text-zinc-400 mb-4">Copy the tracker beacon below and paste it securely into the <code>&lt;head&gt;</code> of <b>{generatedSite.domain}</b>.</p>
            <div className="bg-black p-4 rounded-lg font-mono text-sm text-green-400 overflow-x-auto whitespace-pre">
              {`<script defer data-site="${generatedSite.id}" src="https://insight-os.com/tracker.js"></script>`}
            </div>
          </div>
        )}

        <div className="mt-12">
          <h2 className="text-lg text-white font-bold mb-4">Active Deployments ({sites.length})</h2>
          <div className="grid grid-cols-2 gap-4">
            {sites.map(site => (
              <div key={site.id} className="bg-[#111] border border-zinc-800 p-4 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{site.domain}</span>
                  <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">Active</span>
                </div>
                <div className="text-xs text-zinc-600 mt-2">ID: {site.id}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
