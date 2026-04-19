'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';
import { UserPlus, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Signup() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      setError('Password must contain both letters and numbers.');
      return;
    }

    const response = await apiService.register({ name, email, phone, password });
    if (!response.success) {
      setError(response.message || 'Unable to register');
      return;
    }

    const loginSuccess = await login(email, password);
    if (loginSuccess) {
      router.push('/dashboard');
    } else {
      setError('Registration successful, but login failed. Please try logging in manually.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card-premium bg-white p-10 space-y-8">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-yellow-400 rounded-3xl mx-auto flex items-center justify-center border-4 border-black -rotate-2 shadow-xl">
            <UserPlus className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Register</h1>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Issue New Transit Pass</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="label-small">Full Name</label>
            <input 
              required type="text" placeholder="John Doe"
              className="w-full bg-zinc-50 border-4 border-black rounded-2xl py-4 px-6 font-black focus:outline-none focus:ring-4 ring-yellow-400/20"
              value={name} onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="label-small">Mobile Money Number</label>
            <input 
              required type="tel" placeholder="07... "
              className="w-full bg-zinc-50 border-4 border-black rounded-2xl py-4 px-6 font-black focus:outline-none focus:ring-4 ring-yellow-400/20"
              value={phone} onChange={e => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="label-small">Email Address</label>
            <input 
              required type="email" placeholder="john@example.ug"
              className="w-full bg-zinc-50 border-4 border-black rounded-2xl py-4 px-6 font-black focus:outline-none focus:ring-4 ring-yellow-400/20"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="label-small">Password</label>
            <input 
              required type="password" placeholder="••••••"
              className="w-full bg-zinc-50 border-4 border-black rounded-2xl py-4 px-6 font-black focus:outline-none focus:ring-4 ring-yellow-400/20"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-500 text-white text-[11px] font-black uppercase rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" className="w-full btn-yellow py-5 text-xl flex items-center justify-center gap-3">
            Register Pass <ArrowRight className="w-6 h-6" />
          </button>
        </form>

        <div className="text-center pt-4 border-t-4 border-zinc-100">
          <p className="text-sm font-bold text-zinc-400">Already have a pass?</p>
          <Link href="/login" className="text-sm font-black uppercase underline hover:text-yellow-500 transition-colors">
            Authorized Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
