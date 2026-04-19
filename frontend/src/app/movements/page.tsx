'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { CalendarDays, Clock, MapPin, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface DepartureRow {
  id: string;
  hubId: string;
  travelDate: string;
  departureTime: string;
  destination: string;
  busTag: string;
  busType: string;
  status: string;
  expectedArrivalAt?: string | null;
}

interface ArrivalRow {
  id: string;
  hubId: string;
  travelDate: string;
  departureTime: string;
  destination: string;
  status: string;
  expectedArrivalAt?: string | null;
  busTag?: string | null;
}

function dateKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function MovementsPage() {
  const [selectedDate, setSelectedDate] = useState(dateKey(0));
  const [hubId, setHubId] = useState<string>('');
  const [hubs, setHubs] = useState<Array<{ id: string; name: string }>>([]);
  const [departures, setDepartures] = useState<DepartureRow[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => {
    return [0, 1, 2].map((i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return { key: `${y}-${m}-${day}`, label: i === 0 ? 'Today' : d.toLocaleDateString() };
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [h, dep, arr] = await Promise.all([
        apiService.getHubs(),
        apiService.getDepartures({ hubId: hubId || undefined, startDate: selectedDate }),
        apiService.getArrivals({ hubId: hubId || undefined, startDate: selectedDate }),
      ]);
      setHubs(h.data || []);
      setDepartures((dep.data || []).filter((d: DepartureRow) => d.travelDate === selectedDate));
      setArrivals((arr.data || []).filter((a: ArrivalRow) => a.travelDate === selectedDate));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [hubId, selectedDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  const minWindowLabel = '06:30 AM';
  const maxWindowLabel = '11:59 PM';
  const displayedDepartures = useMemo(() => {
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
    const windowStart = 6 * 60 + 30;
    const windowEnd = 23 * 60 + 59;
    const now = new Date();
    const todayKey = dateKey(0);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return departures
      .filter((d) => d.travelDate === selectedDate)
      .filter((d) => {
        const mins = parse(d.departureTime);
        if (mins === null) return true;
        if (mins < windowStart || mins > windowEnd) return false;
        if (selectedDate === todayKey && mins <= nowMin) return false;
        return true;
      });
  }, [departures, selectedDate]);

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex items-start justify-between flex-wrap gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-black flex items-center gap-3">
            <CalendarDays className="w-8 h-8" /> Movements
          </h1>
          <div className="text-zinc-500 font-bold text-sm">
            Departures vs arrivals side-by-side · {minWindowLabel} to {maxWindowLabel} · auto-updates in real time.
          </div>
        </div>
        <button
          onClick={refresh}
          className="px-6 py-4 rounded-2xl bg-black text-yellow-400 border-4 border-black font-black uppercase tracking-widest text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white border-4 border-black rounded-[32px] p-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedDate(opt.key)}
              className={`px-6 py-3 rounded-2xl border-4 font-black uppercase text-xs tracking-widest ${
                selectedDate === opt.key ? 'bg-black text-yellow-400 border-black' : 'bg-white text-black border-black hover:bg-zinc-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={hubId}
            onChange={(e) => setHubId(e.target.value)}
            className="flex-1 px-5 py-4 rounded-2xl border-4 border-black font-bold"
          >
            <option value="">All hubs</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="text-red-600 font-black">{error}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-3">Departures</div>
          <div className="grid grid-cols-1 gap-4">
            {displayedDepartures.length === 0 && !loading && (
              <div className="bg-white border-4 border-black rounded-[32px] p-8 font-bold text-zinc-600">
                No upcoming departures in window.
              </div>
            )}
            {displayedDepartures.map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-4 border-black rounded-[32px] p-6 flex items-start justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <MapPin className="w-5 h-5" /> {d.destination}
                  </div>
                  <div className="text-sm font-bold text-zinc-600">
                    Bus {d.busTag} · {d.busType}
                  </div>
                  <div className="text-sm font-black text-black flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Departs: {selectedDate} {d.departureTime}
                  </div>
                  {d.expectedArrivalAt && (
                    <div className="text-sm font-black text-black flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Arrives (est): {new Date(d.expectedArrivalAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <span className="px-4 py-2 rounded-xl bg-black text-yellow-400 font-black uppercase text-xs tracking-widest">
                  {d.status}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-2xl font-black uppercase tracking-tighter border-b-4 border-black pb-3">Arrivals</div>
          <div className="grid grid-cols-1 gap-4">
            {arrivals.length === 0 && !loading && (
              <div className="bg-white border-4 border-black rounded-[32px] p-8 font-bold text-zinc-600">
                No arrivals for this day.
              </div>
            )}
            {arrivals.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-4 border-black rounded-[32px] p-6 flex items-start justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Clock className="w-5 h-5" /> {a.departureTime}
                  </div>
                  <div className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <MapPin className="w-5 h-5" /> {a.destination}
                  </div>
                  {a.expectedArrivalAt && (
                    <div className="text-sm font-black text-black">
                      Expected arrival: {new Date(a.expectedArrivalAt).toLocaleString()}
                    </div>
                  )}
                  <div className="text-sm font-bold text-zinc-600">
                    {a.busTag ? `Bus ${a.busTag}` : 'Bus'} · Trip {a.id}
                  </div>
                </div>
                <span className="px-4 py-2 rounded-xl bg-black text-yellow-400 font-black uppercase text-xs tracking-widest">
                  {a.status}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
