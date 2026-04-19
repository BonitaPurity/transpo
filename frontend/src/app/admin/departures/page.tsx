'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { motion } from 'framer-motion';
import { CalendarDays, PlusCircle, RefreshCw, Trash2, Save } from 'lucide-react';

interface Hub {
  id: string;
  name: string;
}

interface Schedule {
  id: string;
  hubId: string;
  destination: string;
  departureTime: string;
  price: number;
  busType: string;
  status: string;
}

interface Bus {
  id: string;
  tag: string;
  hubId: string;
  seatCapacity?: number;
  approved?: boolean;
}

interface DepartureRow {
  id: string;
  scheduleId: string;
  busId: string;
  hubId: string;
  travelDate: string;
  status: string;
  destination: string;
  departureTime: string;
  busType: string;
  price: number;
  busTag: string;
  seatCapacity: number;
  occupiedSeats: number;
  seatsAvailable: number;
  isSoldOut: boolean;
}

function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

export default function AdminDeparturesPage() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hubId, setHubId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(todayKey(0));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [departures, setDepartures] = useState<DepartureRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const dateOptions = useMemo(() => {
    return [0, 1, 2].map((i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return { key: `${y}-${m}-${day}`, label: i === 0 ? 'Today' : d.toLocaleDateString() };
    });
  }, []);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => (hubId ? s.hubId === hubId : true));
  }, [schedules, hubId]);

  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    filteredSchedules.forEach((s) => {
      if (s.destination) set.add(s.destination);
    });
    return Array.from(set).sort();
  }, [filteredSchedules]);

  const timeOptions = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const to12h = (mins: number) => {
      const h24 = Math.floor(mins / 60);
      const m = mins % 60;
      const ap = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${pad(h12)}:${pad(m)} ${ap}`;
    };
    const start = 6 * 60 + 30;
    const end = 23 * 60 + 59;
    const out: string[] = [];
    for (let t = start; t <= end; t += 15) {
      out.push(to12h(t));
    }
    return out;
  }, []);

  const [newDestination, setNewDestination] = useState('');
  const [newDepartureTime, setNewDepartureTime] = useState('');
  const [newBusId, setNewBusId] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const scheduleTimesForDestination = useMemo(() => {
    if (!hubId || !newDestination) return [];
    const parse = (time: string) => {
      const m = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return null;
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const ap = m[3].toUpperCase();
      let hour24 = hh % 12;
      if (ap === 'PM') hour24 += 12;
      return hour24 * 60 + mm;
    };
    const start = 6 * 60 + 30;
    const end = 23 * 60 + 59;
    const set = new Set<string>();
    filteredSchedules
      .filter((s) => s.destination === newDestination)
      .forEach((s) => {
        const mins = parse(s.departureTime);
        if (mins === null) return;
        if (mins < start || mins > end) return;
        set.add(s.departureTime);
      });
    return Array.from(set).sort();
  }, [filteredSchedules, hubId, newDestination]);

  const approvedBuses = useMemo(() => {
    return buses.filter((b) => (hubId ? b.hubId === hubId : true));
  }, [buses, hubId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [h, s, f, d] = await Promise.all([
        apiService.getHubs(),
        apiService.getSchedules(hubId || undefined),
        apiService.getFleet(hubId || undefined),
        apiService.getDepartures({ hubId: hubId || undefined, startDate: selectedDate, includePast: true }),
      ]);
      setHubs(h.data || []);
      setSchedules(s.data || []);
      setBuses((f.data || []).filter((b: Bus) => b.approved !== false));
      setDepartures((d.data || []).filter((row: DepartureRow) => row.travelDate === selectedDate));
    } catch (e) {
      setError(getErrorMessage(e) || 'Failed to load departures');
    } finally {
      setLoading(false);
    }
  }, [hubId, selectedDate]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!hubId && hubs.length > 0) {
      setHubId(hubs[0].id);
    }
  }, [hubId, hubs]);

  const createDeparture = async () => {
    if (!hubId) {
      setError('Select a hub first.');
      return;
    }
    if (!newDestination.trim() || !newDepartureTime.trim() || !newBusId) {
      setError('Select destination, time, and an approved bus.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await apiService.createDeparture({
        hubId,
        destination: newDestination.trim(),
        departureTime: newDepartureTime.trim(),
        busId: newBusId,
        travelDate: selectedDate,
        status: 'Scheduled',
      });
      if (!res.success) {
        throw new Error(res.message || 'Failed to create departure');
      }
      setNewDestination('');
      setNewBusId('');
      await refreshAll();
    } catch (e) {
      setError(getErrorMessage(e) || 'Failed to create departure');
    } finally {
      setCreating(false);
    }
  };

  const saveDeparture = async (dep: DepartureRow, updates: { busId?: string; status?: string }) => {
    setSavingId(dep.id);
    setError('');
    try {
      const res = await apiService.updateDeparture(dep.id, updates);
      if (!res.success) throw new Error(res.message || 'Failed to update departure');
      await refreshAll();
    } catch (e) {
      setError(getErrorMessage(e) || 'Failed to update departure');
    } finally {
      setSavingId(null);
    }
  };

  const deleteDeparture = async (dep: DepartureRow) => {
    setDeletingId(dep.id);
    setError('');
    try {
      const res = await apiService.deleteDeparture(dep.id);
      if (!res.success) throw new Error(res.message || 'Failed to delete departure');
      await refreshAll();
    } catch (e) {
      setError(getErrorMessage(e) || 'Failed to delete departure');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-yellow-400 flex items-center gap-3">
            <CalendarDays className="w-7 h-7" /> Departures
          </h1>
          <div className="text-white/50 font-bold text-sm">Manage approved-bus departures and live seat inventory.</div>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-black uppercase text-xs tracking-widest border border-white/10"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-4 font-bold text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-zinc-950 border border-yellow-400/20 rounded-3xl p-6 space-y-4">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30">Filters</div>

          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Hub</div>
            <select
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold"
            >
              <option value="">All hubs</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Date</div>
            <div className="flex flex-wrap gap-3">
              {dateOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedDate(opt.key)}
                  className={`px-4 py-2 rounded-xl border font-black uppercase text-[10px] tracking-widest ${
                    selectedDate === opt.key
                      ? 'bg-yellow-400 text-black border-yellow-400'
                      : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-zinc-950 border border-yellow-400/20 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30">Create Departure</div>
              <div className="text-white/60 font-bold text-sm">Only approved buses are selectable.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Destination</div>
              <input
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                placeholder="Enter destination (e.g., Mbarara)"
                list="admin_destination_suggestions"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold"
                disabled={!hubId}
              />
              <datalist id="admin_destination_suggestions">
                {destinationOptions.map((dest) => (
                  <option key={dest} value={dest} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Time</div>
              <input
                value={newDepartureTime}
                onChange={(e) => setNewDepartureTime(e.target.value)}
                placeholder="06:30 AM"
                list="admin_time_suggestions"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold"
                disabled={!hubId}
              />
              <datalist id="admin_time_suggestions">
                {(scheduleTimesForDestination.length ? scheduleTimesForDestination : timeOptions).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <div className="text-white/40 font-bold text-[10px]">
                Allowed: 06:30 AM to 11:59 PM
              </div>
            </div>

            <select
              value={newBusId}
              onChange={(e) => setNewBusId(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold"
            >
              <option value="">Select approved bus</option>
              {approvedBuses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.tag} ({b.seatCapacity ?? 45} seats)
                </option>
              ))}
            </select>

            <button
              disabled={creating}
              onClick={createDeparture}
              className="flex items-center justify-center gap-2 bg-yellow-400 text-black font-black uppercase text-xs tracking-widest rounded-xl px-4 py-3 border border-yellow-400 hover:bg-yellow-300 disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4" /> {creating ? 'Creating...' : 'Create'}
            </button>
          </div>

          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30 pt-2">Active Departures</div>

          <div className="grid grid-cols-1 gap-4">
            {departures.length === 0 && !loading && (
              <div className="text-white/50 font-bold text-sm">No departures found for this date.</div>
            )}
            {departures.map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-white font-black uppercase tracking-tighter text-lg">
                    {d.departureTime} → {d.destination}
                  </div>
                  <div className="text-white/50 font-bold text-xs">
                    Bus {d.busTag} · {d.busType} · Date {d.travelDate}
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <select
                      value={d.busId}
                      onChange={(e) => {
                        const busId = e.target.value;
                        setDepartures((prev) => prev.map((x) => (x.id === d.id ? { ...x, busId } : x)));
                      }}
                      className="bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-white font-black text-[10px] uppercase tracking-widest"
                    >
                      {approvedBuses
                        .filter((b) => !hubId || b.hubId === hubId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.tag} ({b.seatCapacity ?? 45})
                          </option>
                        ))}
                    </select>
                    <select
                      value={d.status}
                      onChange={(e) => {
                        const status = e.target.value;
                        setDepartures((prev) => prev.map((x) => (x.id === d.id ? { ...x, status } : x)));
                      }}
                      className="bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-white font-black text-[10px] uppercase tracking-widest"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Boarding">Boarding</option>
                      <option value="Delayed">Delayed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 font-black uppercase text-[10px] tracking-widest">
                    {d.occupiedSeats}/{d.seatCapacity} occupied
                  </span>
                  <span className={`px-3 py-2 rounded-xl border font-black uppercase text-[10px] tracking-widest ${
                    d.isSoldOut ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-green-500/10 border-green-500/30 text-green-300'
                  }`}>
                    {d.isSoldOut ? 'Sold Out' : `${d.seatsAvailable} seats left`}
                  </span>
                  <button
                    onClick={() => saveDeparture(d, { busId: d.busId, status: d.status })}
                    disabled={savingId === d.id}
                    className="px-4 py-2 rounded-xl bg-yellow-400 text-black font-black uppercase text-[10px] tracking-widest border border-yellow-400 disabled:opacity-60 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> {savingId === d.id ? 'Saving' : 'Save'}
                  </button>
                  <button
                    onClick={() => saveDeparture(d, { status: 'Cancelled' })}
                    disabled={savingId === d.id}
                    className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300 font-black uppercase text-[10px] tracking-widest border border-red-500/30 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteDeparture(d)}
                    disabled={deletingId === d.id}
                    className="px-4 py-2 rounded-xl bg-white/5 text-white/70 font-black uppercase text-[10px] tracking-widest border border-white/10 disabled:opacity-60 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> {deletingId === d.id ? 'Deleting' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
