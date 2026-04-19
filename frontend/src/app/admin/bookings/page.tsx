'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const hubColor: Record<string, string> = { hub_east: '#facc15', hub_west: '#38bdf8', hub_north: '#fb923c' };

interface Booking {
  id: string;
  passengerName: string;
  phoneNumber: string;
  destination: string;
  busType: string;
  departureTime: string;
  createdAt: string;
  travelDate: string;
  paymentStatus: string;
  totalAmount: number;
  hubId: string;
  userEmail?: string | null;
  busTag?: string | null;
}

export default function AdminBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | ''>('');


  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!user?.email) return;
    setExporting(format);
    try {
      await apiService.downloadAdminBookingsExport(format, 'Completed');
    } finally {
      setExporting('');
    }
  };

  useEffect(() => {
    async function loadBookings() {
      if (!user?.email) return;
      try {
        const res = await apiService.getBookings();
        if (res.success) setBookings(res.data);
      } catch (err) {
        console.error('Failed to load bookings', err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, [user]);

  return (
    <div className="space-y-8 text-white">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">Booking Manifest</h2>
          <p className="text-white/40 text-sm font-bold mt-1">All passenger tickets across every regional hub.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-zinc-800 border border-zinc-700 px-5 py-3 rounded-2xl flex items-center gap-2">
            <Search className="w-4 h-4 text-white/30" />
            <input type="text" placeholder="Search..." className="bg-transparent text-sm font-bold outline-none text-white placeholder:text-white/20 w-32" />
          </div>
          <button className="p-3.5 bg-zinc-800 border border-zinc-700 rounded-2xl hover:border-yellow-400/40 transition-all">
            <Filter className="w-4 h-4 text-white/40" />
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={!!exporting || bookings.length === 0}
            className={`px-4 py-3 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 ${
              exporting === 'csv' ? 'bg-zinc-700 text-white' : 'bg-yellow-400 hover:scale-105 active:scale-95 text-black'
            }`}
          >
            {exporting === 'csv' ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!!exporting || bookings.length === 0}
            className={`px-4 py-3 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 ${
              exporting === 'pdf' ? 'bg-zinc-700 text-white' : 'bg-yellow-400 hover:scale-105 active:scale-95 text-black'
            }`}
          >
            {exporting === 'pdf' ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </button>
        </div>
      </header>

      <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl overflow-hidden">
        <div className="grid grid-cols-7 gap-4 px-8 py-4 border-b border-zinc-700 text-[9px] font-black uppercase tracking-widest text-white/30">
          <div>Pass ID</div>
          <div className="col-span-2">Passenger</div>
          <div>Route</div>
          <div>Bus Type</div>
          <div>Schedule</div>
          <div>Status</div>
        </div>

        <div className="divide-y divide-zinc-700/50">
          {loading ? (
            <div className="p-20 text-center font-black uppercase tracking-widest text-white/20 animate-pulse">Accessing Manifest...</div>
          ) : bookings.length === 0 ? (
            <div className="p-20 text-center font-black uppercase tracking-widest text-white/20">No records found</div>
          ) : bookings.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="grid grid-cols-7 gap-4 px-8 py-5 items-center hover:bg-zinc-700/30 transition-all"
            >
              <div className="font-black text-yellow-400 text-sm">{b.id}</div>
              <div className="col-span-2">
                <div className="font-black text-white text-sm">{b.passengerName}</div>
                <div className="text-[10px] font-bold text-white/30">{b.phoneNumber}{b.userEmail ? ` · ${b.userEmail}` : ''}</div>
              </div>
              <div className="text-sm font-bold text-white/70">Kampala → {b.destination}</div>
              <div>
                <span
                  className="text-[10px] font-black px-2 py-1 rounded-xl uppercase border"
                  style={{ color: hubColor[b.hubId] ?? '#fff', borderColor: `${hubColor[b.hubId]}40`, background: `${hubColor[b.hubId]}15` }}
                >
                  {b.busType}
                </span>
              </div>
              <div className="text-[10px] font-bold text-white/40 uppercase">{b.travelDate} · {b.departureTime}</div>
              <div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                  b.paymentStatus === 'Completed' ? 'bg-green-500/20 text-green-400'
                  : b.paymentStatus === 'Pending'   ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-zinc-700 text-white/30'
                }`}>
                  {b.paymentStatus}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="px-8 py-4 border-t border-zinc-700 flex justify-between text-[10px] font-black uppercase text-white/20">
          <span>Showing {bookings.length} records</span>
          <span>Total Revenue: UGX {bookings.reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
