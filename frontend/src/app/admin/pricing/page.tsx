'use client';

import { useState, useEffect } from 'react';
import { Tag, Save, Pencil, X, CheckCircle2 } from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/hooks/useNotify';

interface BusFareRow {
  busId: string;
  busTag: string;
  hubId: string;
  destination: string;
  fareAmount: number | null;
}

export default function AdminPricing() {
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError } = useNotify();
  const [busFares, setBusFares] = useState<BusFareRow[]>([]);
  const [savedBusId, setSavedBusId] = useState<string | null>(null);
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [busFareValue, setBusFareValue] = useState<string>('');

  useEffect(() => {
    async function loadBusFares() {
      if (!user?.email) return;
      try {
        const res = await apiService.getBusFares();
        if (res.success) setBusFares(res.data);
      } catch {
        notifyError('Failed to load bus fares.');
      }
    }
    loadBusFares();
  }, [user, notifyError]);

  const totalBusFarePotential = busFares.reduce((s, b) => s + (b.fareAmount ?? 0), 0);

  return (
    <div className="space-y-8 text-white">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">Fare Matrix</h2>
          <p className="text-white/40 text-sm font-bold mt-1">Set ticket prices per bus. Changes apply immediately to the passenger dashboard.</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-right">
          <div className="text-xs font-black uppercase text-white/30 mb-1">Combined Bus Fare Value</div>
          <div className="text-2xl font-black text-yellow-400">UGX {totalBusFarePotential.toLocaleString()}</div>
        </div>
      </header>

      <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-6 gap-4 px-4 sm:px-6 lg:px-8 py-4 border-b border-zinc-700 text-xs font-black uppercase tracking-widest text-white/20">
              <div>Bus Tag</div>
              <div>Hub</div>
              <div className="col-span-2">Destination</div>
              <div>Fare (UGX)</div>
              <div>Actions</div>
            </div>
            <div className="divide-y divide-zinc-700/40">
              {busFares.length === 0 && (
                <div className="px-8 py-12 text-center text-white/20 font-black uppercase tracking-widest text-xs">
                  No buses found
                </div>
              )}
              {busFares.map((b) => (
                <div key={b.busId} className="grid grid-cols-6 gap-4 px-4 sm:px-6 lg:px-8 py-5 items-center hover:bg-zinc-700/20 transition-all min-w-0">
                  <div className="min-w-0">
                    <span className="text-xs font-black px-2 py-1 rounded-xl uppercase border border-yellow-400/20 bg-yellow-400/10 text-yellow-300 inline-flex">
                      {b.busTag}
                    </span>
                  </div>
                  <div className="text-xs font-black uppercase text-white/40 truncate">{b.hubId}</div>
                  <div className="col-span-2 min-w-0">
                    <div className="font-black text-white truncate">{b.destination || '—'}</div>
                  </div>
                  <div className="min-w-0">
                    {editingBusId === b.busId ? (
                      <input
                        type="number"
                        value={busFareValue}
                        onChange={(e) => setBusFareValue(e.target.value)}
                        className="w-full bg-zinc-900 border-2 border-yellow-400 rounded-xl px-3 py-2 text-yellow-400 font-black text-sm outline-none min-h-11"
                        autoFocus
                      />
                    ) : (
                      <div className="font-black text-white text-sm truncate">
                        UGX {(b.fareAmount ?? 0).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    {editingBusId === b.busId ? (
                      <>
                        <button
                          onClick={async () => {
                            if (!user?.email) return;
                            const amt = Math.max(0, parseInt(busFareValue || '0', 10) || 0);
                            try {
                              const res = await apiService.updateBusFare(b.busId, amt);
                              if (res.success) {
                                setBusFares((prev) => prev.map((x) => (x.busId === b.busId ? { ...x, fareAmount: amt } : x)));
                                setEditingBusId(null);
                                setSavedBusId(b.busId);
                                notifySuccess('Bus fare updated');
                                setTimeout(() => setSavedBusId(null), 1500);
                              } else {
                                notifyError(res.message || 'Update failed');
                              }
                            } catch {
                              notifyError('Update failed.');
                            }
                          }}
                          className="p-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-all border border-green-500/30 shrink-0"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingBusId(null)}
                          className="p-2 bg-zinc-700 text-white/50 rounded-xl hover:bg-zinc-600 transition-all shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : savedBusId === b.busId ? (
                      <div className="flex items-center gap-1.5 text-green-400 text-xs font-black uppercase min-w-0">
                        <CheckCircle2 className="w-4 h-4 shrink-0" /> <span className="truncate">Saved</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingBusId(b.busId);
                          setBusFareValue(String(b.fareAmount ?? 0));
                        }}
                        className="p-2 bg-zinc-700 text-white/40 rounded-xl hover:bg-yellow-400/20 hover:text-yellow-400 transition-all border border-transparent hover:border-yellow-400/20 shrink-0"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs font-black uppercase text-white/20 text-center pt-4">
        <Tag className="w-3.5 h-3.5 inline mr-1.5" />
        Price changes are applied immediately to the passenger dashboard
      </div>
    </div>
  );
}
