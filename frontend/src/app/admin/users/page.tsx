'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, ShieldCheck, Activity } from 'lucide-react';
import { apiService } from '@/services/api';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  createdAt?: string;
  accessCount: number;
  lastAccessAt?: string | null;
  bookingCount: number;
}

interface AdminUserDetailsBooking {
  id: string;
  destination: string | null;
  travelDate: string | null;
  paymentStatus: string;
}

interface AdminUserDetailsPayload {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'user' | 'admin';
    createdAt?: string;
    updatedAt?: string | null;
    accessCount: number;
    lastAccessAt?: string | null;
  };
  usage: {
    bookingCount: number;
    completedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    lastBookingAt?: string | null;
  };
  recentBookings: AdminUserDetailsBooking[];
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordUser, setPasswordUser] = useState<AdminUserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [detailsUser, setDetailsUser] = useState<AdminUserRow | null>(null);
  const [details, setDetails] = useState<AdminUserDetailsPayload | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await apiService.getAdminUsers();
        if (!res.success) throw new Error(res.message || 'Failed to load users');
        setUsers(res.data || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalAccesses = useMemo(() => users.reduce((s, u) => s + (u.accessCount || 0), 0), [users]);
  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-8 text-white">
      <header>
        <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">User Registry</h2>
        <p className="text-white/40 text-sm font-bold mt-1">
          {users.length} registered users · {totalAccesses.toLocaleString()} total system accesses.
        </p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-4 font-bold text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-2xl px-8 py-8 text-white/50 font-bold">
          Loading passengers...
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {!loading && users.map((u, i) => (
          <motion.div
            key={u.email}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-zinc-800/60 border border-zinc-700 rounded-2xl px-8 py-5 flex items-center gap-8 hover:border-yellow-400/30 transition-all cursor-pointer"
            onClick={async () => {
              setDetailsUser(u);
              setDetails(null);
              setDetailsError('');
              setDetailsLoading(true);
              const res = await apiService.getAdminUserDetails(u.id);
              setDetailsLoading(false);
              if (!res?.success) {
                setDetailsError(res?.message || 'Failed to load user details');
                return;
              }
              setDetails(res.data);
            }}
          >
            <div className="w-12 h-12 bg-yellow-400/10 border-2 border-yellow-400/20 rounded-2xl flex items-center justify-center text-yellow-400 font-black text-lg shrink-0">
              {u.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-white text-base">{u.name}</div>
              <div className="flex items-center gap-4 mt-1 text-[10px] font-bold text-white/30 uppercase">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone}</span>
              </div>
            </div>
            <div className="text-center hidden md:block">
              <div className="text-[9px] font-black uppercase text-white/30 mb-1">Bookings</div>
              <div className="text-2xl font-black text-white">{u.bookingCount}</div>
            </div>
            <div className="text-center hidden md:block">
              <div className="text-[9px] font-black uppercase text-white/30 mb-1">Accesses</div>
              <div className="text-2xl font-black text-white">{u.accessCount}</div>
            </div>
            <div className="text-center hidden lg:block">
              <div className="text-[9px] font-black uppercase text-white/30 mb-1">Last Access</div>
              <div className="text-[11px] font-black text-white">{formatDate(u.lastAccessAt)}</div>
            </div>
            <div className="text-center hidden lg:block">
              <div className="text-[9px] font-black uppercase text-white/30 mb-1">Joined</div>
              <div className="text-[11px] font-black text-white">{formatDate(u.createdAt)}</div>
            </div>
            <div>
              <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-1.5 rounded-full ${
                u.accessCount > 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-zinc-700 text-white/30'
              }`}>
                {u.accessCount > 0 ? <ShieldCheck className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                {u.accessCount > 0 ? 'Active' : 'New'}
              </span>
            </div>
            <div className="ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPasswordUser(u);
                  setNewPassword('');
                  setPasswordMsg('');
                  setPasswordErr('');
                }}
                className="bg-yellow-400 text-black border-2 border-yellow-400/0 rounded-xl px-4 py-2 font-black text-[10px] uppercase tracking-widest hover:bg-yellow-300"
              >
                Set Password
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {detailsUser ? (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setDetailsUser(null)}
        >
          <div
            className="w-full max-w-3xl bg-white border-4 border-black rounded-[32px] p-8 text-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Passenger Details</div>
            <div className="text-2xl font-black uppercase tracking-tighter">{detailsUser.name}</div>
            <div className="text-sm font-bold text-zinc-600">{detailsUser.email} · {detailsUser.phone}</div>

            {detailsError ? (
              <div className="bg-red-50 border-4 border-black rounded-2xl p-4 font-black text-xs uppercase tracking-widest text-red-700">
                {detailsError}
              </div>
            ) : null}
            {detailsLoading ? (
              <div className="bg-zinc-100 border-4 border-black rounded-2xl p-6 font-black text-xs uppercase tracking-widest text-zinc-500">
                Loading...
              </div>
            ) : null}

            {details && details.user ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="border-4 border-black rounded-2xl p-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Accesses</div>
                  <div className="text-2xl font-black">{details.user.accessCount}</div>
                </div>
                <div className="border-4 border-black rounded-2xl p-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Bookings</div>
                  <div className="text-2xl font-black">{details.usage?.bookingCount ?? detailsUser.bookingCount}</div>
                </div>
                <div className="border-4 border-black rounded-2xl p-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Completed</div>
                  <div className="text-2xl font-black">{details.usage?.completedBookings ?? 0}</div>
                </div>
                <div className="border-4 border-black rounded-2xl p-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Last Access</div>
                  <div className="text-sm font-black">{formatDate(details.user.lastAccessAt)}</div>
                </div>
              </div>
            ) : null}

            {details?.recentBookings?.length ? (
              <div className="pt-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Recent Bookings</div>
                <div className="mt-2 border-4 border-black rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-5 gap-2 px-4 py-3 bg-zinc-100 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    <div>ID</div>
                    <div className="col-span-2">Route</div>
                    <div>Date</div>
                    <div>Status</div>
                  </div>
                  <div className="divide-y divide-black/10">
                    {details.recentBookings.map((b) => (
                      <div key={b.id} className="grid grid-cols-5 gap-2 px-4 py-3 text-[11px] font-bold">
                        <div className="font-black">{b.id}</div>
                        <div className="col-span-2">{b.destination ? `Kampala → ${b.destination}` : '—'}</div>
                        <div>{b.travelDate || '—'}</div>
                        <div className="font-black">{b.paymentStatus}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setDetailsUser(null)}
                className="bg-black text-yellow-400 border-4 border-black rounded-2xl px-6 py-3 font-black uppercase text-xs shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordUser ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border-4 border-black rounded-[32px] p-8 text-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Admin Action</div>
            <div className="text-2xl font-black uppercase tracking-tighter">Set User Password</div>
            <div className="text-sm font-bold text-zinc-600">
              {passwordUser.name} · {passwordUser.email}
            </div>

            {passwordErr ? (
              <div className="bg-red-50 border-4 border-black rounded-2xl p-4 font-black text-xs uppercase tracking-widest text-red-700">
                {passwordErr}
              </div>
            ) : null}
            {passwordMsg ? (
              <div className="bg-yellow-100 border-4 border-black rounded-2xl p-4 font-black text-xs uppercase tracking-widest">
                {passwordMsg}
              </div>
            ) : null}

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

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPasswordUser(null)}
                className="flex-1 bg-white border-4 border-black rounded-2xl px-6 py-4 font-black uppercase text-xs"
              >
                Cancel
              </button>
              <button
                disabled={passwordSaving}
                onClick={async () => {
                  setPasswordErr('');
                  setPasswordMsg('');
                  if (!newPassword || newPassword.length < 8) {
                    setPasswordErr('Password must be at least 8 characters.');
                    return;
                  }
                  setPasswordSaving(true);
                  const res = await apiService.adminSetUserPassword(passwordUser.id, { newPassword });
                  setPasswordSaving(false);
                  if (!res?.success) {
                    setPasswordErr(res?.message || 'Failed to update password.');
                    return;
                  }
                  setPasswordMsg('Password updated successfully.');
                }}
                className="flex-1 bg-yellow-400 border-4 border-black rounded-2xl px-6 py-4 font-black uppercase text-xs shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
              >
                {passwordSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
