'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function AccountPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!currentPassword || !newPassword) {
      setError('Enter your current password and a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    const res = await apiService.changePassword({ currentPassword, newPassword });
    setLoading(false);

    if (!res?.success) {
      setError(res?.message || 'Failed to update password.');
      return;
    }

    setMessage('Password updated. Please sign in again.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    logout();
    router.replace('/login');
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <header className="space-y-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Account</div>
        <h1 className="text-4xl font-black uppercase tracking-tighter">Security</h1>
        <div className="text-sm font-bold text-zinc-500">
          Signed in as {user.email}
        </div>
      </header>

      <div className="bg-white border-4 border-black rounded-[32px] p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
        <div className="text-xl font-black uppercase tracking-tight">Change Password</div>

        {error ? (
          <div className="mt-4 bg-red-50 border-4 border-black rounded-2xl p-4 font-black text-xs uppercase tracking-widest text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 bg-yellow-100 border-4 border-black rounded-2xl p-4 font-black text-xs uppercase tracking-widest">
            {message}
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Current Password</div>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border-4 border-black rounded-2xl px-5 py-4 font-bold"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">New Password</div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border-4 border-black rounded-2xl px-5 py-4 font-bold"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Confirm New Password</div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border-4 border-black rounded-2xl px-5 py-4 font-bold"
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 border-4 border-black rounded-2xl px-6 py-4 font-black uppercase text-xs shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

