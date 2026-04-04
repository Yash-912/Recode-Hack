'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@insight.os');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      setError('Invalid credentials');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-crimson to-obsidian font-sans">
      <div className="w-full max-w-md p-8 rounded-2xl bg-obsidian/80 backdrop-blur-xl border border-[#333] shadow-2xl relative overflow-hidden">
        
        {/* Subtle top edge glow */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-crimson-bright to-transparent opacity-50" />
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-crimson-glow/20 flex items-center justify-center border border-crimson-bright/30 relative">
            <Shield className="w-8 h-8 text-crimson-bright" />
            <div className="absolute inset-0 rounded-full border border-crimson-bright animate-ping opacity-20" />
          </div>
        </div>

        <h1 className="text-center font-serif text-3xl font-bold italic mb-2 tracking-tight text-white">
          Insight<span className="text-crimson-bright font-sans not-italic font-black text-2xl tracking-normal">OS</span>
        </h1>
        <p className="text-center text-zinc-400 text-sm mb-8">Mission Control Authentication</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-900 text-red-400 text-sm text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-semibold tracking-wider text-zinc-500 mb-2 uppercase">Email Override</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-crimson-bright focus:ring-1 focus:ring-crimson-bright transition-all"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold tracking-wider text-zinc-500 mb-2 uppercase">Encryption Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#111] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-crimson-bright focus:ring-1 focus:ring-crimson-bright transition-all"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full mt-6 bg-crimson-bright hover:bg-red-500 text-white font-semibold py-3 rounded-lg transition-colors relative overflow-hidden group"
          >
            <span className="relative z-10">Initialize Sequence</span>
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-crimson-glow opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-zinc-600 uppercase tracking-widest font-mono">
          Status: <span className="text-crimson-bright animate-pulse">Awaiting Uplink</span>
        </div>
      </div>
    </div>
  );
}
