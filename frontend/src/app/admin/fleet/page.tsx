'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Zap, Radio, Settings, Plus, X } from 'lucide-react';
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
  const [editingValues, setEditingValues] = useState<Partial<Bus>>({ gpsLat: 0, gpsLng: 0, speed: 0, battery: 0, status: '' });

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

  const loadHubs = useCallback(async () => {
    try {
      const res = await apiService.getHubs();
      if (res?.success) {
        setHubs(res.data as Hub[]);




        if (!selectedHub && res.data?.length) {
          setSelectedHub(res.data[0].id);
        }
      }
    } catch {
      setError('Unable to load hubs');
    }
  }, [selectedHub]);

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

  useEffect(() => {
    loadHubs();
  }, [loadHubs]);

  useEffect(() => {
    loadFleet();
    loadDestinations();
    if (!newBus.hubId && selectedHub) {
      setNewBus((prev) => ({ ...prev, hubId: selectedHub }));
    }
  }, [loadFleet, loadDestinations, selectedHub, newBus.hubId]);

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

    const res = await apiService.updateBus(busId, editingValues);
    if (!res?.success) {
      setError(res?.message || 'Unable to update bus');
      return;
    }

    setEditingId(null);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="text-white/50">Loading fleet…</div>
        ) : (
          (fleetByHub || []).map((bus, i) => {
            const color = colorFromHub(bus.hubId);
            const isEditing = editingId === bus.id;

            return (
              <motion.div
                key={bus.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-zinc-800/60 border border-zinc-700 rounded-2xl p-6 space-y-4 hover:border-zinc-500 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Radio className="w-5 h-5" style={{ color }} />
                    <span className="font-black text-white uppercase tracking-wider">{bus.tag}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setEditingId(null);
                      } else {
                        setEditingId(bus.id);
                        setEditingValues({
                          gpsLat: bus.gpsLat || 0,
                          gpsLng: bus.gpsLng || 0,
                          speed: bus.speed || 0,
                          battery: bus.battery || 0,
                          status: bus.status || 'Active',
                          destination: bus.destination || '',
                          seatCapacity: bus.seatCapacity ?? 45,
                        });
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-zinc-700 transition-all"
                  >
                    <Settings className="w-3.5 h-3.5 text-white/30" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-white/40">
                  <MapPin className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-white/80">→ {bus.destination || '—'}</span>
                </div>
                <div className="text-[9px] font-black uppercase text-white/30">
                  Capacity: {bus.seatCapacity ?? 45} · {bus.approved === false ? 'Unapproved' : 'Approved'}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-black uppercase text-white/30 mb-1">Speed</div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-sm font-black text-white">{bus.speed ?? 0} km/h</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase text-white/30 mb-1">Battery</div>
                    <div className="text-sm font-black" style={{ color: bus.battery < 25 ? '#ef4444' : bus.battery < 50 ? '#f59e0b' : '#4ade80' }}>
                      {bus.battery ?? 0}%
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-black uppercase text-white/30 mb-1">GPS</div>
                  <div className="text-sm font-black text-white/80">
                    {bus.gpsLat?.toFixed(5) ?? '—'}, {bus.gpsLng?.toFixed(5) ?? '—'}
                  </div>
                </div>

                <div>
                  <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${bus.battery ?? 0}%`,
                        background: bus.battery < 25 ? '#ef4444' : bus.battery < 50 ? '#f59e0b' : '#4ade80',
                      }}
                    />
                  </div>
                </div>

                <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-full w-fit ${
                  bus.status === 'Active' || bus.status === 'En Route'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400 animate-pulse'
                }`}>
                  {bus.status}
                </div>

                {isEditing && (
                  <div className="bg-zinc-900/30 rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label-small">Destination</label>
                        <input
                          value={String(editingValues.destination ?? bus.destination ?? '')}
                          onChange={(e) => setEditingValues((prev) => ({ ...prev, destination: e.target.value }))}
                          list={destinationListId}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2 font-black text-sm"
                        />
                      </div>
                      <div>
                        <label className="label-small">Seat Capacity</label>
                        <input
                          type="number"
                          value={Number(editingValues.seatCapacity ?? bus.seatCapacity ?? 45)}
                          onChange={(e) => setEditingValues((prev) => ({ ...prev, seatCapacity: Number(e.target.value) }))}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2 font-black text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label-small">GPS Lat</label>
                        <input
                          type="number"
                          value={editingValues.gpsLat}
                          onChange={(e) => setEditingValues((prev) => ({ ...prev, gpsLat: Number(e.target.value) }))}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2 font-black text-sm"
                        />
                      </div>
                      <div>
                        <label className="label-small">GPS Lng</label>
                        <input
                          type="number"
                          value={editingValues.gpsLng}
                          onChange={(e) => setEditingValues((prev) => ({ ...prev, gpsLng: Number(e.target.value) }))}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2 font-black text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label-small">Speed</label>
                        <input
                          type="number"
                          value={editingValues.speed}
                          onChange={(e) => setEditingValues((prev) => ({ ...prev, speed: Number(e.target.value) }))}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2 font-black text-sm"
                        />
                      </div>
                      <div>
                        <label className="label-small">Battery %</label>
                        <input
                          type="number"
                          value={editingValues.battery}
                          onChange={(e) => setEditingValues((prev) => ({ ...prev, battery: Number(e.target.value) }))}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2 font-black text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <select
                        value={editingValues.status}
                        onChange={(e) => setEditingValues((prev) => ({ ...prev, status: e.target.value }))}
                        className="bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2 font-black text-sm"
                      >
                        <option value="Active">Active</option>
                        <option value="En Route">En Route</option>
                        <option value="Charging">Charging</option>
                      </select>
                      <button
                        onClick={() => handleUpdateBus(bus.id)}
                        className="btn-yellow px-5 py-2 font-black uppercase tracking-widest"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
