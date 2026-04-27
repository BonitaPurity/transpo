'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Zap, Settings, Plus, X, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';

interface Hub {
  id: string;
  name: string;
}

interface Bus {
  id: string;
  tag: string;
  hubId: string;
  status: string;
  battery: number;
  speed: number;
  gpsLat: number;
  gpsLng: number;
  destination: string;
  seatCapacity?: number;
  approved?: boolean;
}

export default function AdminFleet() {
  const { user } = useAuth();

  const [fleet, setFleet] = useState<Bus[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHub, setSelectedHub] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [knownDestinations, setKnownDestinations] = useState<string[]>([]);
  const [busyBusId, setBusyBusId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [creating, setCreating] = useState(false);
  const [newBus, setNewBus] = useState<Omit<Bus, 'id'>>({
    tag: '',
    hubId: '',
    destination: '',
    status: 'Active',
    speed: 0,
    battery: 100,
    gpsLat: 0,
    gpsLng: 0,
    seatCapacity: 45,
    approved: true,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<Bus>>({
    tag: '',
    hubId: '',
    destination: '',
    gpsLat: 0,
    gpsLng: 0,
    speed: 0,
    battery: 0,
    status: '',
    seatCapacity: 45,
    approved: true,
  });

  const destinationListId = useMemo(() => `destinations_${selectedHub || 'all'}`, [selectedHub]);



  const loadFleet = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getFleet(selectedHub || undefined);
      if (res?.success) {
        setFleet(res.data as Bus[]);
      }
    } catch {
      setError('Unable to load fleet');
    } finally {
      setIsLoading(false);
    }
  }, [selectedHub]);

  // loadHubs has no deps — it only sets selectedHub on first load via functional updater
  const loadHubs = useCallback(async () => {
    try {
      const res = await apiService.getHubs();
      if (res?.success) {
        setHubs(res.data as Hub[]);
        // Only auto-select the first hub if none is selected yet (avoids re-render loop)
        setSelectedHub((prev) => prev || (res.data?.[0]?.id ?? ''));
      }
    } catch {
      setError('Unable to load hubs');
    }
  }, []); // intentionally empty — no selectedHub dep to prevent infinite loop

  const loadDestinations = useCallback(async () => {
    try {
      const res = await apiService.getSchedules(selectedHub || undefined);
      if (res?.success) {
        const set = new Set<string>();
        (res.data || []).forEach((s: { destination?: string }) => {
          if (s?.destination) set.add(String(s.destination));
        });
        setKnownDestinations(Array.from(set).sort());
      }
    } catch {
      setKnownDestinations([]);
    }
  }, [selectedHub]);

  // Load hubs once on mount
  useEffect(() => {
    loadHubs();
  }, [loadHubs]);

  // Reload fleet + destinations whenever selectedHub changes
  useEffect(() => {
    if (!selectedHub) return;
    loadFleet();
    loadDestinations();
    // Sync newBus.hubId to the selected hub without newBus.hubId as a dep (avoids loop)
    setNewBus((prev) => (prev.hubId === selectedHub ? prev : { ...prev, hubId: selectedHub }));
  }, [selectedHub, loadFleet, loadDestinations]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadFleet();
    }, 8000);
    return () => clearInterval(interval);
  }, [loadFleet]);

  const colorFromHub = (id: string) => {
    return { hub_east: '#facc15', hub_west: '#38bdf8', hub_north: '#fb923c' }[id] ?? '#ffffff';
  };

  const handleCreateBus = async () => {
    setError('');
    if (!user?.email) {
      setError('Admin session is required');
      return;
    }

    if (!newBus.tag || !newBus.hubId) {
      setError('Tag and hub are required');
      return;
    }
    if (!Number.isFinite(Number(newBus.seatCapacity)) || Number(newBus.seatCapacity) <= 0) {
      setError('Seat capacity must be a positive number');
      return;
    }

    const res = await apiService.createBus(newBus);
    if (!res?.success) {
      setError(res?.message || 'Unable to create bus');
      return;
    }

    setNewBus({
      tag: '',
      hubId: newBus.hubId,
      destination: '',
      status: 'Active',
      speed: 0,
      battery: 100,
      gpsLat: 0,
      gpsLng: 0,
      seatCapacity: 45,
      approved: true,
    });
    setCreating(false);
    await loadFleet();
  };

  const handleUpdateBus = async (busId: string) => {
    if (!user?.email) {
      setError('Admin session is required');
      return;
    }

    const updates: Partial<Bus> = {
      tag: editingValues.tag,
      hubId: editingValues.hubId,
      destination: editingValues.destination,
      gpsLat: editingValues.gpsLat,
      gpsLng: editingValues.gpsLng,
      speed: editingValues.speed,
      battery: editingValues.battery,
      status: editingValues.status,
      seatCapacity: editingValues.seatCapacity,
      approved: editingValues.approved,
    };

    if (updates.seatCapacity !== undefined && (!Number.isFinite(Number(updates.seatCapacity)) || Number(updates.seatCapacity) <= 0)) {
      setError('Seat capacity must be a positive number');
      return;
    }

    setBusyBusId(busId);
    const res = await apiService.updateBus(busId, updates);
    if (!res?.success) {
      setError(res?.message || 'Unable to update bus');
      setBusyBusId(null);
      return;
    }

    setEditingId(null);
    setBusyBusId(null);
    await loadFleet();
  };

  const handleDeleteBus = async (busId: string) => {
    if (!user?.email) {
      setError('Admin session is required');
      return;
    }
    setError('');
    setBusyBusId(busId);
    const res = await apiService.deleteBus(busId, deleteReason);
    if (!res?.success) {
      setError(res?.message || 'Unable to delete bus');
      setBusyBusId(null);
      return;
    }
    setConfirmDeleteId(null);
    setDeleteReason('');
    setBusyBusId(null);
    await loadFleet();
  };

  const fleetByHub = selectedHub ? fleet.filter((b: Bus) => b.hubId === selectedHub) : fleet;


  return (
    <div className="space-y-8 text-white">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">Fleet Manager</h2>
          <p className="text-white/40 text-sm font-bold mt-1">Register buses, assign GPS, and track them in near real-time.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={selectedHub}
            onChange={(e) => setSelectedHub(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest"
          >
            {hubs.map((hub) => (
              <option key={hub.id} value={hub.id} className="uppercase">
                {hub.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setCreating((c) => !c)}
            className="inline-flex items-center gap-2 bg-yellow-400 text-black font-black uppercase tracking-widest px-6 py-3 rounded-2xl"
          >
            {creating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {creating ? 'Cancel' : 'Register Bus'}
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-600/80 text-white text-sm font-black uppercase tracking-wider rounded-xl px-5 py-4">
          {error}
        </div>
      )}

      {creating && (
        <div className="bg-zinc-900/40 border border-zinc-700 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label-small">Bus Tag</label>
              <input
                value={newBus.tag}
                onChange={(e) => setNewBus((prev) => ({ ...prev, tag: e.target.value }))}
                placeholder="NMV-123"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm"
              />
            </div>
            <div>
              <label className="label-small">Hub</label>
              <select
                value={newBus.hubId}
                onChange={(e) => setNewBus((prev) => ({ ...prev, hubId: e.target.value }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm"
              >
                <option value="">Select hub</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>{hub.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-small">Destination</label>
              <input
                value={newBus.destination}
                onChange={(e) => setNewBus((prev) => ({ ...prev, destination: e.target.value }))}
                placeholder="Jinja"
                list={destinationListId}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm"
              />
              <datalist id={destinationListId}>
                {knownDestinations.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="label-small">GPS Latitude</label>
              <input
                type="number"
                value={newBus.gpsLat}
                onChange={(e) => setNewBus((prev) => ({ ...prev, gpsLat: Number(e.target.value) }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm"
              />
            </div>
            <div>
              <label className="label-small">GPS Longitude</label>
              <input
                type="number"
                value={newBus.gpsLng}
                onChange={(e) => setNewBus((prev) => ({ ...prev, gpsLng: Number(e.target.value) }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm"
              />
            </div>
            <div>
              <label className="label-small">Status</label>
              <select
                value={newBus.status}
                onChange={(e) => setNewBus((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm"
              >
                <option value="Active">Active</option>
                <option value="En Route">En Route</option>
                <option value="Charging">Charging</option>
              </select>
            </div>
            <div>
              <label className="label-small">Battery %</label>
              <input
                type="number"
                value={newBus.battery}
                onChange={(e) => setNewBus((prev) => ({ ...prev, battery: Number(e.target.value) }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="label-small">Seat Capacity</label>
              <input
                type="number"
                value={newBus.seatCapacity ?? 45}
                onChange={(e) => setNewBus((prev) => ({ ...prev, seatCapacity: Number(e.target.value) }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-3 bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 font-black text-sm w-full">
                <input
                  type="checkbox"
                  checked={newBus.approved !== false}
                  onChange={(e) => setNewBus((prev) => ({ ...prev, approved: e.target.checked }))}
                />
                Approved
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button
              type="button"
              onClick={handleCreateBus}
              className="btn-yellow px-6 py-3 font-black uppercase tracking-widest"
            >
              Save Bus
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="text-white/50">Loading fleet…</div>
        ) : (
          (fleetByHub || []).map((bus) => (
            <motion.div
              key={bus.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-800/60 border border-zinc-700 rounded-3xl p-6 space-y-4 hover:border-yellow-400/40 transition-all group relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-yellow-400 flex items-center justify-center border-2 border-black rotate-2 group-hover:rotate-6 transition-transform">
                    <Zap className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <div className="text-xl font-black tracking-tighter text-yellow-400 truncate max-w-[120px]">{bus.tag}</div>
                    <div className="text-[10px] font-bold text-white/30 uppercase truncate max-w-[120px]">{bus.destination}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    bus.status === 'Active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                    bus.status === 'En Route' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {bus.status}
                  </div>
                  <button 
                    onClick={() => {
                      setEditingId(bus.id);
                      setEditingValues({
                        tag: bus.tag,
                        hubId: bus.hubId,
                        destination: bus.destination,
                        gpsLat: bus.gpsLat,
                        gpsLng: bus.gpsLng,
                        speed: bus.speed,
                        battery: bus.battery,
                        status: bus.status,
                        seatCapacity: bus.seatCapacity ?? 45,
                        approved: bus.approved !== false,
                      });
                    }}
                    className="p-2 hover:bg-zinc-700 rounded-xl transition-colors text-white/40 hover:text-white"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(bus.id)}
                    className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-white/30 hover:text-red-300"
                    disabled={busyBusId === bus.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Battery</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400" style={{ width: `${bus.battery}%` }} />
                    </div>
                    <span className="text-xs font-black text-yellow-400">{bus.battery}%</span>
                  </div>
                </div>
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Speed</div>
                  <div className="text-sm font-black text-white">{bus.speed} <span className="text-[10px] text-white/40">km/h</span></div>
                </div>
              </div>

              <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-white/20" />
                  <div className="text-xs font-bold text-white/60 tabular-nums">
                    {bus.gpsLat.toFixed(4)}, {bus.gpsLng.toFixed(4)}
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>

              <AnimatePresence>
                {editingId === bus.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-0 bg-zinc-900/95 rounded-3xl p-6 z-10 flex flex-col justify-between border-2 border-yellow-400/50 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-yellow-400 tracking-[0.2em]">Update Unit {bus.tag}</span>
                      <button onClick={() => setEditingId(null)}><X className="w-5 h-5" /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-white/30">Bus Tag</label>
                        <input
                          value={String(editingValues.tag || '')}
                          onChange={(e) => setEditingValues((v) => ({ ...v, tag: e.target.value }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-white/30">Hub</label>
                        <select
                          value={String(editingValues.hubId || '')}
                          onChange={(e) => setEditingValues((v) => ({ ...v, hubId: e.target.value }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
                        >
                          {hubs.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1 mt-2">
                      <label className="text-[8px] font-black uppercase text-white/30">Destination</label>
                      <input
                        value={String(editingValues.destination || '')}
                        onChange={(e) => setEditingValues((v) => ({ ...v, destination: e.target.value }))}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-white/30">Latitude</label>
                        <input 
                          type="number" 
                          value={editingValues.gpsLat}
                          onChange={e => setEditingValues(v => ({ ...v, gpsLat: Number(e.target.value) }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-white/30">Longitude</label>
                        <input 
                          type="number" 
                          value={editingValues.gpsLng}
                          onChange={e => setEditingValues(v => ({ ...v, gpsLng: Number(e.target.value) }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-white/30">Status</label>
                        <select 
                          value={editingValues.status}
                          onChange={e => setEditingValues(v => ({ ...v, status: e.target.value }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
                        >
                          <option value="Active">Active</option>
                          <option value="En Route">En Route</option>
                          <option value="Charging">Charging</option>
                          <option value="Maintenance">Maintenance</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-white/30">Battery %</label>
                        <input 
                          type="number" 
                          value={editingValues.battery}
                          onChange={e => setEditingValues(v => ({ ...v, battery: Number(e.target.value) }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-white/30">Seat Capacity</label>
                        <input
                          type="number"
                          value={editingValues.seatCapacity ?? 45}
                          onChange={(e) => setEditingValues((v) => ({ ...v, seatCapacity: Number(e.target.value) }))}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 bg-black/60 border border-white/10 rounded-lg px-2 py-2 text-xs font-bold w-full">
                          <input
                            type="checkbox"
                            checked={editingValues.approved !== false}
                            onChange={(e) => setEditingValues((v) => ({ ...v, approved: e.target.checked }))}
                          />
                          Approved
                        </label>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleUpdateBus(bus.id)}
                      disabled={busyBusId === bus.id}
                      className="w-full bg-yellow-400 text-black font-black uppercase text-[10px] py-3 rounded-xl mt-4 hover:bg-yellow-300 transition-colors"
                    >
                      {busyBusId === bus.id ? 'Syncing...' : 'Apply Sync'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {confirmDeleteId === bus.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-0 bg-zinc-900/95 rounded-3xl p-6 z-20 flex flex-col justify-between border-2 border-red-500/40 backdrop-blur-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">Confirm Delete</div>
                        <button onClick={() => { setConfirmDeleteId(null); setDeleteReason(''); }}><X className="w-5 h-5" /></button>
                      </div>
                      <div className="text-sm font-black text-white">Delete {bus.tag}?</div>
                      <div className="text-[11px] font-bold text-white/60">
                        This is a soft delete. The bus will be removed from fleet lists and fare matrix, but historical records remain.
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-white/30">Reason (optional)</label>
                        <input
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-2 text-xs font-bold"
                          placeholder="e.g., retired vehicle"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-4">
                      <button
                        onClick={() => { setConfirmDeleteId(null); setDeleteReason(''); }}
                        className="w-full bg-white/10 text-white font-black uppercase text-[10px] py-3 rounded-xl border border-white/10"
                        disabled={busyBusId === bus.id}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteBus(bus.id)}
                        className="w-full bg-red-500 text-white font-black uppercase text-[10px] py-3 rounded-xl border border-red-500/40"
                        disabled={busyBusId === bus.id}
                      >
                        {busyBusId === bus.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
