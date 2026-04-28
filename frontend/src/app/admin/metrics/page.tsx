'use client';

import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Lightbulb, Clock, Users, Zap, Target, Loader2, Download, Truck
} from 'lucide-react';


import { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/hooks/useNotify';


// ── Mock data ────────────────────────────────────────────────────
// Mock data for challenges removed - now fetched from API


const WEEKLY_TRENDS = [
  { day: 'Mon', bookings: 620, revenue: 28500000, onTime: 94 },
  { day: 'Tue', bookings: 580, revenue: 26200000, onTime: 96 },
  { day: 'Wed', bookings: 710, revenue: 33800000, onTime: 91 },
  { day: 'Thu', bookings: 690, revenue: 31500000, onTime: 93 },
  { day: 'Fri', bookings: 890, revenue: 42100000, onTime: 88 },
  { day: 'Sat', bookings: 1020, revenue: 51300000, onTime: 85 },
  { day: 'Sun', bookings: 780, revenue: 38700000, onTime: 92 },
];
const maxBookings = Math.max(...WEEKLY_TRENDS.map(t => t.bookings));

const ROUTE_PERF = [
  { route: 'Kampala→Gulu',       hub: 'KWP', utilization: 95, avgDelay: '8 min', revenue: 55000,  trend: 'up' },
  { route: 'Kampala→Mbarara',    hub: 'BSG', utilization: 85, avgDelay: '3 min', revenue: 45000,  trend: 'up' },
  { route: 'Kampala→Jinja',      hub: 'NMV', utilization: 78, avgDelay: '5 min', revenue: 25000,  trend: 'neutral' },
  { route: 'Kampala→Entebbe',    hub: 'NMV', utilization: 72, avgDelay: '2 min', revenue: 15000,  trend: 'down' },
  { route: 'Kampala→Fort Portal',hub: 'BSG', utilization: 60, avgDelay: '12 min',revenue: 55000,  trend: 'neutral' },
];
const hubColor: Record<string, string> = { NMV: '#facc15', BSG: '#38bdf8', KWP: '#fb923c' };

const severityConfig = {
  critical: { border: 'border-red-500/40',   bg: 'bg-red-500/10',   text: 'text-red-400',   label: 'CRITICAL', dot: 'bg-red-500' },
  warning:  { border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'WARNING',  dot: 'bg-amber-500' },
  info:     { border: 'border-blue-500/40',  bg: 'bg-blue-500/10',  text: 'text-blue-400',  label: 'INFO',     dot: 'bg-blue-400' },
};

const statusConfig = {
  action_required: { label: 'Action Required', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  in_progress:     { label: 'In Progress',      cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  monitoring:      { label: 'Monitoring',       cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  resolved:        { label: 'Resolved',         cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

interface Challenge {
  id: string;
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'action_required' | 'in_progress' | 'monitoring' | 'resolved';
  metric: string;
  solution: string;
  impact: string;
}

interface MetricsData {
  todayBookings: number;
  todayRevenue: number;
  todayDeliveryRevenue: number;
  totalDeliveryRevenue: number;
  onTimeRate: string;
  challenges: Challenge[];
}

export default function AdminMetrics() {
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError } = useNotify();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [liveStats, setLiveStats] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | ''>('');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [exportMonth, setExportMonth] = useState('');



  useEffect(() => {
    async function loadMetrics() {
      if (!user?.email) return;
      try {
        const res = await apiService.getDetailedMetrics();
        if (res.success) {
          const data = res.data as MetricsData;
          setChallenges(data.challenges || []);
          setLiveStats(data);
        }






      } catch {
        console.error('Metrics sync failed');
        notifyError('Ops Intelligence sync failed.');
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, [user, notifyError]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!user?.email) return;
    setExporting(format);
    try {
      await apiService.downloadMetrics(format, exportDateFrom, exportDateTo, exportMonth);
      notifySuccess(format === 'pdf' ? 'Ops Intelligence PDF downloaded.' : 'Ops Intelligence CSV downloaded.');
    } catch {
      notifyError(format === 'pdf' ? 'Failed to download Ops Intelligence PDF.' : 'Failed to download Ops Intelligence CSV.');
    } finally {
      setExporting('');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 text-white">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-baseline justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">Ops Intelligence</h2>
            <p className="text-white/40 text-sm font-bold mt-1">Live challenges, automated solutions, and network performance metrics.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={() => handleExport('csv')}
              disabled={!!exporting}
              className="bg-black text-yellow-400 border-2 border-yellow-400/30 px-6 py-3 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] tracking-widest hover:bg-yellow-400 hover:text-black transition-all disabled:opacity-50 group hover:scale-105"
            >
              {exporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />}
              Download Audit (CSV)
            </button>
            <button 
              onClick={() => handleExport('pdf')}
              disabled={!!exporting}
              className="bg-black text-yellow-400 border-2 border-yellow-400/30 px-6 py-3 rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] tracking-widest hover:bg-yellow-400 hover:text-black transition-all disabled:opacity-50 group hover:scale-105"
            >
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />}
              Download Audit (PDF)
            </button>
          </div>
        </div>

        {/* Date / Month filter for export */}
        <div className="flex flex-wrap items-center gap-3 bg-zinc-800/40 border border-zinc-700 rounded-2xl px-5 py-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30 shrink-0">Export period:</span>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase text-white/40 shrink-0">Month</label>
            <input
              type="month"
              value={exportMonth}
              onChange={(e) => { setExportMonth(e.target.value); setExportDateFrom(''); setExportDateTo(''); }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none hover:border-yellow-400/40 transition-all"
            />
          </div>

          <div className="text-white/20 font-black text-xs">or</div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[10px] font-black uppercase text-white/40 shrink-0">From</label>
            <input
              type="date"
              value={exportDateFrom}
              onChange={(e) => { setExportDateFrom(e.target.value); setExportMonth(''); }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none hover:border-yellow-400/40 transition-all"
            />
            <label className="text-[10px] font-black uppercase text-white/40 shrink-0">To</label>
            <input
              type="date"
              value={exportDateTo}
              onChange={(e) => { setExportDateTo(e.target.value); setExportMonth(''); }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none hover:border-yellow-400/40 transition-all"
            />
          </div>

          {(exportMonth || exportDateFrom || exportDateTo) && (
            <button
              onClick={() => { setExportMonth(''); setExportDateFrom(''); setExportDateTo(''); }}
              className="text-[10px] font-black uppercase text-red-400 hover:text-red-300 transition-colors px-3 py-2 rounded-xl border border-red-500/20 hover:border-red-500/40"
            >
              Clear
            </button>
          )}

          <span className="text-[10px] font-bold text-white/30 ml-auto">
            {exportMonth ? `Period: ${exportMonth}` : exportDateFrom ? `${exportDateFrom}${exportDateTo ? ` → ${exportDateTo}` : ''}` : 'All time (no filter)'}
          </span>
        </div>
      </header>


      {/* Quick summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        {[
          { label: 'Challenges Today',      value: challenges.filter(c => c.status !== 'resolved').length, icon: AlertTriangle, color: '#f87171', sub: `${challenges.filter(c=>c.status==='resolved').length} resolved` },
          { label: 'On-Time Rate',           value: liveStats?.onTimeRate || '91%',   icon: Clock,    color: '#4ade80', sub: 'Calculated live' },
          { label: "Today's Bookings",       value: liveStats?.todayBookings || '0',  icon: Users,    color: '#38bdf8', sub: 'Real DB entries' },
          { label: "Today's Revenue",        value: `UGX ${(liveStats?.todayRevenue || 0).toLocaleString()}`, icon: Target, color: '#facc15', sub: 'Ticket payments today' },
          { label: "Delivery Fees",          value: `UGX ${(liveStats?.totalDeliveryRevenue || 0).toLocaleString()}`, icon: Truck, color: '#a78bfa', sub: `UGX ${(liveStats?.todayDeliveryRevenue || 0).toLocaleString()} today` },
        ].map((s, i) => (

          <motion.div key={s.label} initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}
            className="bg-zinc-800/60 border border-zinc-700 rounded-3xl p-6 space-y-3 hover:border-zinc-600 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{s.label}</span>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div className="text-3xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-bold text-white/20 uppercase">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Challenges + Solutions */}
      <div className="space-y-5">
        <h3 className="text-2xl font-black text-yellow-400 uppercase italic tracking-tighter flex items-center gap-3">
          <AlertTriangle className="w-6 h-6" /> Active Challenges & Resolutions
        </h3>

        {challenges.map((c, i) => {

          const sv = severityConfig[c.severity as keyof typeof severityConfig];
          const st = statusConfig[c.status as keyof typeof statusConfig];
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`border-2 ${sv.border} ${sv.bg} rounded-3xl p-8 space-y-5`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${sv.dot} ${c.status !== 'resolved' ? 'animate-pulse' : ''}`} />
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${sv.text} border ${sv.border} bg-black/30`}>{sv.label}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                    </div>
                    <h4 className="text-lg font-black text-white">{c.title}</h4>
                    <p className="text-sm font-bold text-white/50 mt-1 max-w-2xl">{c.detail}</p>
                  </div>
                </div>
                <div className={`shrink-0 text-right px-4 py-2 rounded-2xl border ${sv.border} bg-black/30`}>
                  <div className="text-[9px] font-black uppercase text-white/20 mb-0.5">Live Metric</div>
                  <div className={`text-lg font-black ${sv.text}`}>{c.metric}</div>
                </div>
              </div>

              {/* Solution */}
              <div className="flex items-start gap-4 bg-black/30 border border-white/5 rounded-2xl p-5">
                <div className="w-8 h-8 bg-yellow-400/10 border border-yellow-400/30 rounded-xl flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-black uppercase text-yellow-400/60 mb-1 tracking-widest">Recommended Action</div>
                  <p className="text-sm font-bold text-white/70">{c.solution}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-black uppercase text-white/20 mb-0.5">Expected Impact</div>
                  <div className="text-sm font-black text-green-400 flex items-center gap-1 justify-end">
                    <CheckCircle2 className="w-4 h-4" />{c.impact}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Weekly Bookings Bar Chart */}
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl p-8 space-y-6">
        <h3 className="text-2xl font-black text-yellow-400 uppercase italic tracking-tighter flex items-center gap-3">
          <BarChart3 className="w-6 h-6" /> 7-Day Booking Volume
        </h3>
        <div className="flex items-end gap-4 h-48">
          {WEEKLY_TRENDS.map((d, i) => {
            const pct = (d.bookings / maxBookings) * 100;
            const isMax = d.bookings === maxBookings;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-black text-white/40">{d.bookings}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ delay: i * 0.07, type: 'spring', damping: 18 }}
                  className={`w-full rounded-t-xl ${isMax ? 'bg-yellow-400' : 'bg-zinc-600 hover:bg-zinc-500'} transition-colors`}
                  style={{ height: `${pct}%` }}
                  title={`${d.revenue.toLocaleString()} UGX`}
                />
                <div className="text-center">
                  <div className="text-[10px] font-black text-white/50 uppercase">{d.day}</div>
                  <div className={`text-[9px] font-bold ${d.onTime >= 90 ? 'text-green-400' : 'text-amber-400'}`}>{d.onTime}%</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-6 text-[10px] font-black uppercase text-white/20">
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-400" /> Peak Day</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-zinc-600" /> Booking Volume</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /> On-Time %</span>
        </div>
      </div>

      {/* Route Performance Table */}
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl">
        <div className="px-4 sm:px-6 lg:px-8 py-6 border-b border-zinc-700 flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-yellow-400" />
          <h3 className="text-2xl font-black text-yellow-400 uppercase italic tracking-tighter">Route Performance</h3>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-6 gap-4 px-4 sm:px-6 lg:px-8 py-3 text-xs font-black uppercase tracking-widest text-white/20">
              <div className="col-span-2">Route</div>
              <div>Hub</div>
              <div>Utilization</div>
              <div>Avg Delay</div>
              <div>Fare / Trend</div>
            </div>

            <div className="divide-y divide-zinc-700/30">
              {ROUTE_PERF.map((r, i) => (
                <motion.div
                  key={r.route}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="grid grid-cols-6 gap-4 px-4 sm:px-6 lg:px-8 py-5 items-center hover:bg-zinc-700/20 transition-all min-w-0"
                >
                  <div className="col-span-2 font-black text-white text-sm min-w-0 truncate">{r.route}</div>
                  <div className="min-w-0">
                    <span
                      className="text-xs font-black px-2 py-1 rounded-xl uppercase border inline-flex"
                      style={{ color: hubColor[r.hub], borderColor: `${hubColor[r.hub]}40`, background: `${hubColor[r.hub]}15` }}
                    >
                      {r.hub}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden min-w-20">
                        <div className="h-full rounded-full" style={{ width: `${r.utilization}%`, background: r.utilization > 85 ? '#f87171' : r.utilization > 65 ? '#fb923c' : '#4ade80' }} />
                      </div>
                      <span className="text-xs font-black text-white shrink-0">{r.utilization}%</span>
                    </div>
                  </div>
                  <div className={`text-sm font-black ${parseInt(r.avgDelay) > 8 ? 'text-red-400' : parseInt(r.avgDelay) > 4 ? 'text-amber-400' : 'text-green-400'}`}>
                    {r.avgDelay}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-black text-white truncate">UGX {r.revenue.toLocaleString()}</span>
                    {r.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400 shrink-0" />}
                    {r.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />}
                    {r.trend === 'neutral' && <Zap className="w-4 h-4 text-white/20 shrink-0" />}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
