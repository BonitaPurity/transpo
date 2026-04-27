'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Search, Download } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Completed');
  const [error, setError] = useState('');

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!user?.email) return;
    setExporting(format);
    try {
      await apiService.downloadAdminBookingsExport(format, statusFilter);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Export failed', err);
      alert(`Export failed: ${message}`);
    } finally {
      setExporting('');
    }
  };

  const loadBookings = async () => {
    if (!user?.email) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiService.getBookings({ 
        paymentStatus: statusFilter === 'All' ? undefined : statusFilter, 
        search 
      });
      if (res.success) {
        setBookings(res.data);
      } else {
        setError(res.message || 'Failed to load manifest');
      }
    } catch (err) {
      console.error('Failed to load bookings', err);
      setError('Connection failed. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBookings();
    }, 400);
    return () => clearTimeout(timer);
  }, [user, search, statusFilter]);

  return (
    <div className="space-y-8 text-white">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">Booking Manifest</h2>
          <p className="text-white/40 text-sm font-bold mt-1">All passenger tickets across every regional hub.</p>
        </div>
        <div className="flex items-center flex-wrap gap-3">
          <div className="bg-zinc-800 border border-zinc-700 px-5 py-3 rounded-2xl flex items-center gap-2 min-h-11">
            <Search className="w-4 h-4 text-white/30 shrink-0" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none text-white placeholder:text-white/20 w-40 sm:w-48" 
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 px-4 py-3 rounded-2xl text-sm font-bold outline-none text-white appearance-none cursor-pointer hover:border-yellow-400/40 transition-all min-h-11"
          >
            <option value="All">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button
            onClick={() => handleExport('csv')}
            disabled={!!exporting || bookings.length === 0}
            className={`px-4 py-3 rounded-2xl transition-all font-black uppercase text-xs tracking-widest flex items-center gap-2 min-h-11 whitespace-nowrap ${
              exporting === 'csv' ? 'bg-zinc-700 text-white' : 'bg-yellow-400 hover:scale-105 active:scale-95 text-black'
            }`}
          >
            {exporting === 'csv' ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!!exporting || bookings.length === 0}
            className={`px-4 py-3 rounded-2xl transition-all font-black uppercase text-xs tracking-widest flex items-center gap-2 min-h-11 whitespace-nowrap ${
              exporting === 'pdf' ? 'bg-zinc-700 text-white' : 'bg-yellow-400 hover:scale-105 active:scale-95 text-black'
            }`}
          >
            {exporting === 'pdf' ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-center">
          <p className="text-red-400 font-black uppercase text-xs tracking-widest">{error}</p>
          <button onClick={loadBookings} className="mt-4 text-white/40 hover:text-white font-bold text-[10px] uppercase">Try Again</button>
        </div>
      )}

      <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className="grid grid-cols-7 gap-4 px-4 sm:px-6 lg:px-8 py-4 border-b border-zinc-700 text-xs font-black uppercase tracking-widest text-white/30">
              <div>Pass ID</div>
              <div className="col-span-2">Passenger</div>
              <div>Route</div>
              <div>Bus Type</div>
              <div>Schedule</div>
              <div>Status</div>
            </div>

            <div className="divide-y divide-zinc-700/50">
              {loading ? (
                <div className="p-10 sm:p-20 text-center font-black uppercase tracking-widest text-white/20 animate-pulse">Accessing Manifest...</div>
              ) : bookings.length === 0 ? (
                <div className="p-10 sm:p-20 text-center font-black uppercase tracking-widest text-white/20">No records found</div>
              ) : bookings.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="grid grid-cols-7 gap-4 px-4 sm:px-6 lg:px-8 py-5 items-center hover:bg-zinc-700/30 transition-all min-w-0"
                >
                  <div className="font-black text-yellow-400 text-xs sm:text-sm truncate" title={b.id}>{b.id}</div>
                  <div className="col-span-2 min-w-0">
                    <div className="font-black text-white text-sm truncate">{b.passengerName}</div>
                    <div className="text-xs font-bold text-white/30 truncate">{b.phoneNumber}{b.userEmail ? ` · ${b.userEmail}` : ''}</div>
                  </div>
                  <div className="text-sm font-bold text-white/70 min-w-0 truncate">Kampala → {b.destination}</div>
                  <div className="min-w-0">
                    <span
                      className="text-xs font-black px-2 py-1 rounded-xl uppercase border inline-flex"
                      style={{ color: hubColor[b.hubId] ?? '#fff', borderColor: `${hubColor[b.hubId]}40`, background: `${hubColor[b.hubId]}15` }}
                    >
                      {b.busType}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white/40 uppercase truncate">{b.travelDate} · {b.departureTime}</div>
                  <div className="min-w-0">
                    <span className={`text-xs font-black uppercase px-2 py-1 rounded-full inline-flex ${
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

            <div className="px-4 sm:px-6 lg:px-8 py-4 border-t border-zinc-700 flex flex-wrap gap-2 justify-between text-xs font-black uppercase text-white/20">
              <span>Showing {bookings.length} records</span>
              <span>Total Revenue: UGX {bookings.reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
