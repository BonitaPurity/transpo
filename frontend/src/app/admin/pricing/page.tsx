'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Save, Pencil, X, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/hooks/useNotify';


interface Route {
  id: string;
  tag: string;
  hub: string;
  hubCode: string;
  destination: string;
  distance: string;
  currentPrice: number;
  basePrice: number;
  peakSurcharge: number;
  isPeak: boolean;
  color: string;
}

interface BusFareRow {
  busId: string;
  busTag: string;
  hubId: string;
  destination: string;
  fareAmount: number | null;
}

// Initial mock data removed - now fetched from API


const hubColor: Record<string, string> = { NMV: '#facc15', BSG: '#38bdf8', KWP: '#fb923c' };

export default function AdminPricing() {
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError } = useNotify();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [busFares, setBusFares] = useState<BusFareRow[]>([]);
  const [tab, setTab] = useState<'buses' | 'routes'>('buses');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ base: string; peak: string }>({ base: '', peak: '' });
  const [savedId, setSavedId] = useState<string | null>(null);
  const [expandedHub, setExpandedHub] = useState<string | null>('NMV');
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [busFareValue, setBusFareValue] = useState<string>('');

  useEffect(() => {
    async function loadRoutes() {
      if (!user?.email) return;
      try {
        const res = await apiService.getPricing();
        if (res.success) setRoutes(res.data);
      } catch {
        console.error('Failed to load routes');
        notifyError('Connection to fare server failed.');
      }
    }
    loadRoutes();
  }, [user, notifyError]);

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

  const startEdit = (route: Route) => {
    setEditingId(route.id);
    setEditValues({ base: String(route.basePrice), peak: String(route.peakSurcharge) });
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async (routeId: string) => {
    if (!user?.email) return;
    const base = parseInt(editValues.base) || 0;
    const peak = parseInt(editValues.peak) || 0;
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    const currentPrice = route.isPeak ? base + peak : base;

    try {
      const res = await apiService.updatePricing(routeId, {
        basePrice: base,
        peakSurcharge: peak,
        currentPrice
      });

      if (res.success) {
        setRoutes(prev => prev.map(r => r.id === routeId ? res.data : r));
        setEditingId(null);
        setSavedId(routeId);
        notifySuccess('Route price updated');
        setTimeout(() => setSavedId(null), 2000);
      } else {
        notifyError(res.message || 'Failed to update price');
      }
    } catch {
      notifyError('Update failed.');
    }
  };

  const togglePeak = async (routeId: string) => {
    if (!user?.email) return;
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    const isPeak = !route.isPeak;
    const currentPrice = isPeak ? route.basePrice + route.peakSurcharge : route.basePrice;

    try {
      const res = await apiService.updatePricing(routeId, { isPeak, currentPrice });
      if (res.success) {
        setRoutes(prev => prev.map(r => r.id === routeId ? res.data : r));
        notifySuccess(`${route.tag} mode changed`);
      }
    } catch {
      notifyError('Toggle failed.');
    }
  };


  const totalRevenuePotential = routes.reduce((s, r) => s + r.currentPrice, 0);
  const totalBusFarePotential = busFares.reduce((s, b) => s + (b.fareAmount ?? 0), 0);

  return (
    <div className="space-y-8 text-white">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">Fare Matrix</h2>
          <p className="text-white/40 text-sm font-bold mt-1">Set ticket prices per bus (recommended) or manage route baselines.</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-right">
          <div className="text-[9px] font-black uppercase text-white/30 mb-1">{tab === 'buses' ? 'Combined Bus Fare Value' : 'Combined Route Value'}</div>
          <div className="text-2xl font-black text-yellow-400">UGX {(tab === 'buses' ? totalBusFarePotential : totalRevenuePotential).toLocaleString()}</div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setTab('buses')}
          className={`px-5 py-3 rounded-2xl font-black uppercase text-xs tracking-widest border ${
            tab === 'buses' ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-zinc-800/60 text-white/60 border-zinc-700 hover:bg-zinc-700/30'
          }`}
        >
          Per Bus Pricing
        </button>
        <button
          onClick={() => setTab('routes')}
          className={`px-5 py-3 rounded-2xl font-black uppercase text-xs tracking-widest border ${
            tab === 'routes' ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-zinc-800/60 text-white/60 border-zinc-700 hover:bg-zinc-700/30'
          }`}
        >
          Route Baselines
        </button>
      </div>

      {tab === 'buses' && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-6 gap-4 px-8 py-4 border-b border-zinc-700 text-[9px] font-black uppercase tracking-widest text-white/20">
            <div>Bus Tag</div>
            <div>Hub</div>
            <div className="col-span-2">Destination</div>
            <div>Fare (UGX)</div>
            <div>Actions</div>
          </div>
          <div className="divide-y divide-zinc-700/40">
            {busFares.map((b) => (
              <div key={b.busId} className="grid grid-cols-6 gap-4 px-8 py-5 items-center hover:bg-zinc-700/20 transition-all">
                <div>
                  <span className="text-xs font-black px-2 py-1 rounded-xl uppercase border border-yellow-400/20 bg-yellow-400/10 text-yellow-300">
                    {b.busTag}
                  </span>
                </div>
                <div className="text-[10px] font-black uppercase text-white/40">{b.hubId}</div>
                <div className="col-span-2">
                  <div className="font-black text-white">{b.destination || '—'}</div>
                </div>
                <div>
                  {editingBusId === b.busId ? (
                    <input
                      type="number"
                      value={busFareValue}
                      onChange={(e) => setBusFareValue(e.target.value)}
                      className="w-full bg-zinc-900 border-2 border-yellow-400 rounded-xl px-3 py-2 text-yellow-400 font-black text-sm outline-none"
                    />
                  ) : (
                    <div className="font-black text-white text-sm">UGX {(b.fareAmount ?? 0).toLocaleString()}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
                              setSavedId(b.busId);
                              notifySuccess('Bus fare updated');
                              setTimeout(() => setSavedId(null), 1500);
                            } else {
                              notifyError(res.message || 'Update failed');
                            }
                          } catch {
                            notifyError('Update failed.');
                          }
                        }}
                        className="p-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-all border border-green-500/30"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingBusId(null)}
                        className="p-2 bg-zinc-700 text-white/50 rounded-xl hover:bg-zinc-600 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : savedId === b.busId ? (
                    <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-black uppercase">
                      <CheckCircle2 className="w-4 h-4" /> Saved
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingBusId(b.busId);
                        setBusFareValue(String(b.fareAmount ?? 0));
                      }}
                      className="p-2 bg-zinc-700 text-white/40 rounded-xl hover:bg-yellow-400/20 hover:text-yellow-400 transition-all border border-transparent hover:border-yellow-400/20"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'routes' && (
      <>
      {/* Alert banner */}
      <div className="flex items-start gap-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-amber-300">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-sm font-bold">
          <span className="font-black text-amber-400">Route Pricing</span> — These are baseline route fares used when a bus-specific fare is not set.
        </div>
      </div>

      {/* Route table grouped by hub */}
      {['NMV', 'BSG', 'KWP'].map(code => {
        const name = { NMV: 'Namanve', BSG: 'Busega', KWP: 'Kawempe' }[code]!;
        const color = hubColor[code]!;
        const hubRoutes = routes.filter(r => r.hubCode === code);
        const isExpanded = expandedHub === code;

        return (
          <motion.div key={code} layout className="bg-zinc-800/60 border border-zinc-700 rounded-3xl overflow-hidden">
            {/* Hub header */}
            <button
              onClick={() => setExpandedHub(isExpanded ? null : code)}
              className="w-full flex items-center justify-between px-8 py-5 hover:bg-zinc-700/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-black text-sm" style={{ background: color }}>
                  {code}
                </div>
                <div className="text-left">
                  <div className="font-black text-white uppercase tracking-widest">{name} Hub · {code}</div>
                  <div className="text-[10px] font-bold text-white/30 uppercase">{hubRoutes.length} routes · UGX {hubRoutes.reduce((s,r) => s + r.currentPrice, 0).toLocaleString()} total</div>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-5 h-5 text-white/30" /> : <ChevronDown className="w-5 h-5 text-white/30" />}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {/* Column headers */}
                  <div className="grid grid-cols-7 gap-4 px-8 py-3 border-t border-zinc-700 text-[9px] font-black uppercase tracking-widest text-white/20">
                    <div>Bus Tag</div>
                    <div className="col-span-2">Destination</div>
                    <div>Base Price</div>
                    <div>Peak Surcharge</div>
                    <div>Live Fare</div>
                    <div>Actions</div>
                  </div>

                  <div className="divide-y divide-zinc-700/40">
                    {hubRoutes.map(route => (
                      <div key={route.id} className="grid grid-cols-7 gap-4 px-8 py-5 items-center hover:bg-zinc-700/20 transition-all">
                        {/* Tag */}
                        <div>
                          <span className="text-xs font-black px-2 py-1 rounded-xl uppercase border" style={{ color, borderColor: `${color}40`, background: `${color}15` }}>
                            {route.tag}
                          </span>
                        </div>

                        {/* Destination */}
                        <div className="col-span-2">
                          <div className="font-black text-white">{route.destination}</div>
                          <div className="text-[10px] text-white/30 font-bold">{route.distance}</div>
                        </div>

                        {/* Base price */}
                        <div>
                          {editingId === route.id ? (
                            <input
                              type="number"
                              value={editValues.base}
                              onChange={e => setEditValues(v => ({ ...v, base: e.target.value }))}
                              className="w-full bg-zinc-900 border-2 border-yellow-400 rounded-xl px-3 py-2 text-yellow-400 font-black text-sm outline-none"
                            />
                          ) : (
                            <div className="font-black text-white text-sm">UGX {route.basePrice.toLocaleString()}</div>
                          )}
                        </div>

                        {/* Peak surcharge */}
                        <div>
                          {editingId === route.id ? (
                            <input
                              type="number"
                              value={editValues.peak}
                              onChange={e => setEditValues(v => ({ ...v, peak: e.target.value }))}
                              className="w-full bg-zinc-900 border-2 border-amber-400 rounded-xl px-3 py-2 text-amber-400 font-black text-sm outline-none"
                            />
                          ) : (
                            <div className="text-sm font-black text-amber-400">+UGX {route.peakSurcharge.toLocaleString()}</div>
                          )}
                        </div>

                        {/* Live fare */}
                        <div>
                          <div className={`text-xl font-black ${route.isPeak ? 'text-amber-400' : 'text-green-400'}`}>
                            UGX {route.currentPrice.toLocaleString()}
                          </div>
                          <button
                            onClick={() => togglePeak(route.id)}
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border mt-1 transition-all ${
                              route.isPeak
                                ? 'border-amber-500/40 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                : 'border-zinc-600 bg-zinc-700 text-white/30 hover:border-white/20'
                            }`}
                          >
                            {route.isPeak ? '⚡ Peak' : 'Standard'}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {editingId === route.id ? (
                            <>
                              <button onClick={() => saveEdit(route.id)} className="p-2 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-all border border-green-500/30">
                                <Save className="w-4 h-4" />
                              </button>
                              <button onClick={cancelEdit} className="p-2 bg-zinc-700 text-white/50 rounded-xl hover:bg-zinc-600 transition-all">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : savedId === route.id ? (
                            <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-black uppercase">
                              <CheckCircle2 className="w-4 h-4" /> Saved
                            </div>
                          ) : (
                            <button onClick={() => startEdit(route)} className="p-2 bg-zinc-700 text-white/40 rounded-xl hover:bg-yellow-400/20 hover:text-yellow-400 transition-all border border-transparent hover:border-yellow-400/20">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      </>
      )}

      <div className="text-[10px] font-black uppercase text-white/20 text-center pt-4">
        <Tag className="w-3.5 h-3.5 inline mr-1.5" />
        Price changes are applied immediately to the passenger dashboard
      </div>
    </div>
  );
}
