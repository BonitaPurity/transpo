'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Bus, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function Login() {
  const [tab, setTab] = useState<'user' | 'admin'>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, adminLogin } = useAuth();
  const router = useRouter();

  const validateEmail = (email: string) => {
    return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    const ok = await login(email, password);
    if (ok) {
      router.push('/dashboard');
    } else {
      setError('Invalid credentials.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    const ok = await adminLogin(email, password);
    if (ok) {
      router.push('/admin');
    } else {
      setError('Invalid admin credentials.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      {/* Tab switcher */}
      <div className="flex mb-0 border-4 border-black rounded-t-[32px] overflow-hidden">
        <button
          onClick={() => { setTab('user'); setError(''); }}
          className={`flex-1 py-4 font-black text-xs uppercase tracking-widest transition-all ${tab === 'user' ? 'bg-yellow-400 text-black' : 'bg-white text-zinc-400 hover:bg-zinc-50'}`}
        >
          Passenger
        </button>
        <button
          onClick={() => { setTab('admin'); setError(''); }}
          className={`flex-1 py-4 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${tab === 'admin' ? 'bg-black text-yellow-400' : 'bg-white text-zinc-400 hover:bg-zinc-50'}`}
        >
          <ShieldAlert className="w-4 h-4" /> Admin
        </button>
      </div>

      <div className={`card-premium p-10 space-y-8 rounded-t-none ${tab === 'admin' ? 'bg-black text-yellow-400' : 'bg-yellow-400 text-black'}`}>
        <div className="text-center space-y-3">
          <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center border-4 rotate-2 shadow-xl ${tab === 'admin' ? 'bg-yellow-400 border-yellow-400' : 'bg-black border-black'}`}>
            {tab === 'admin' ? <ShieldAlert className="w-8 h-8 text-black" /> : <Bus className="text-yellow-400 w-8 h-8" />}
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">{tab === 'admin' ? 'Admin Portal' : 'Sign In'}</h1>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${tab === 'admin' ? 'text-yellow-400/60' : 'text-black/60'}`}>
            {tab === 'admin' ? 'TRANSPO HUB Secure Administrative Access' : 'Transit Management Protocol'}
          </p>
        </div>

        <form onSubmit={tab === 'admin' ? handleAdminLogin : handleUserLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="label-small">{tab === 'admin' ? 'Admin Email' : 'Passenger Email'}</label>
            <input
              required type="email"
              placeholder={tab === 'admin' ? 'admin@transpo.ug' : 'you@example.ug'}
              className={`w-full border-4 border-black rounded-2xl py-4 px-6 font-black focus:outline-none ${tab === 'admin' ? 'bg-zinc-900 text-yellow-400 placeholder:text-zinc-600' : 'bg-white text-black placeholder:text-zinc-300'}`}
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="label-small">Password / PIN</label>
            <input
              required type="password"
              placeholder="••••••"
              className={`w-full border-4 border-black rounded-2xl py-4 px-6 font-black focus:outline-none ${tab === 'admin' ? 'bg-zinc-900 text-yellow-400 placeholder:text-zinc-600' : 'bg-white text-black placeholder:text-zinc-300'}`}
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-500 text-white text-[11px] font-black uppercase rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" className={`w-full font-black py-5 rounded-2xl text-xl border-4 flex items-center justify-center gap-3 transition-all active:scale-95 ${tab === 'admin' ? 'bg-yellow-400 text-black border-yellow-400 hover:bg-yellow-300' : 'bg-black text-yellow-400 border-white hover:bg-zinc-800'}`}>
            {tab === 'admin' ? 'Access Control Room' : 'Authorize'} <ArrowRight className="w-6 h-6" />
          </button>
        </form>

        {tab === 'user' && (
          <div className={`text-center pt-4 border-t-4 ${tab === 'user' ? 'border-black/10' : 'border-yellow-400/10'}`}>
            <p className="text-sm font-bold">New to the network?</p>
            <Link href="/signup" className="text-sm font-black uppercase underline hover:opacity-70 transition">
              Register for Transit Pass
            </Link>
          </div>
        )}

        {tab === 'admin' && (
          <div className="text-center text-[10px] font-black uppercase tracking-widest opacity-30 pt-2">
            <ShieldCheck className="w-4 h-4 inline mr-1" /> Encrypted Admin Channel
          </div>
        )}
      </div>
    </div>
  );
}
