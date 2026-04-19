'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { CalendarDays, MapPin, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface ArrivalRow {
  id: string;
  hubId: string;
  destination: string;
  travelDate: string;
  departureTime: string;
  expectedArrivalAt?: string;
  status: string;
  busTag?: string;
}

function dateKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function ArrivalsPage() {
  const [selectedDate, setSelectedDate] = useState(dateKey(0));
  const [destination, setDestination] = useState('');
  const [rows, setRows] = useState<ArrivalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => {
    return [0, 1, 2].map((i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return { key: d.toISOString().slice(0, 10), label: i === 0 ? 'Today' : d.toLocaleDateString() };
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.getArrivals({ startDate: selectedDate, destination: destination.trim() || undefined });
      if (!res.success) throw new Error(res.message || 'Failed to load arrivals');
      const list = (res.data || []).filter((r: ArrivalRow) => r.travelDate === selectedDate);
      setRows(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load arrivals');
    } finally {
      setLoading(false);
    }
  }, [destination, selectedDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex items-start justify-between flex-wrap gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-black flex items-center gap-3">
            <CalendarDays className="w-8 h-8" /> Arrivals
          </h1>
          <div className="text-zinc-500 font-bold text-sm">Track expected arrivals for loved ones and inbound cargo.</div>
        </div>
        <button
          onClick={refresh}
          className="px-6 py-4 rounded-2xl bg-black text-yellow-400 border-4 border-black font-black uppercase tracking-widest text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white border-4 border-black rounded-[32px] p-6 space-y-6">
        <div className="flex flex-wrap gap-4">
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
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Filter by destination (e.g., Mbarara)"
            className="flex-1 px-5 py-4 rounded-2xl border-4 border-black font-bold"
          />
          <button
            onClick={refresh}
            className="px-8 py-4 rounded-2xl bg-yellow-400 text-black border-4 border-black font-black uppercase tracking-widest text-xs"
          >
            Search
          </button>
        </div>

        {error && <div className="text-red-600 font-black">{error}</div>}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {rows.length === 0 && !loading && (
          <div className="bg-white border-4 border-black rounded-[32px] p-8 font-bold text-zinc-600">
            No arrivals found for this day.
          </div>
        )}
        {rows.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border-4 border-black rounded-[32px] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="text-2xl font-black uppercase tracking-tighter">{r.destination}</div>
              <div className="text-sm font-bold text-zinc-600 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {r.busTag ? `Bus ${r.busTag}` : 'Bus'} · Departed {r.departureTime}
              </div>
              {r.expectedArrivalAt && (
                <div className="text-sm font-black text-black">
                  Expected arrival: {new Date(r.expectedArrivalAt).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 rounded-xl bg-black text-yellow-400 font-black uppercase text-xs tracking-widest">
                {r.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
