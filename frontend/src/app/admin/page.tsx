'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  Bus, Users, TicketCheck, Activity,
  TrendingUp, AlertCircle, ShieldCheck, Database, Zap, Clock, Construction, Truck
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/hooks/useNotify';

interface Stats {
  totalBuses: number;
  totalBookings: number;
  totalRevenue: number;
  activeSchedules: number;
  totalDeliveryRevenue: number;
}

interface Booking {
  id: string;
  passengerName: string;
  destination: string;
  departureTime: string;
  createdAt: string;
  paymentStatus: string;
}

interface Alert {
  id: string;
  message: string;
  severity: 'warning' | 'ok' | 'info';
}

export default function AdminOverview() {
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError } = useNotify();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenarioLoading, setScenarioLoading] = useState<string | null>(null);



  const triggerScenario = async (scenario: string) => {
    if (!user?.email) return;
    setScenarioLoading(scenario);
    try {
      const res = await apiService.triggerScenario(scenario);
      const data = res;
      if (data.success) {
        notifySuccess(data.message);
      } else {
        notifyError(data.message || 'Scenario trigger failed');
      }
    } catch {
      notifyError('An unexpected error occurred.');
    } finally {
      setTimeout(() => setScenarioLoading(null), 1000);
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!user?.email) return;
      try {
        const [statsRes, bookingsRes, alertsRes] = await Promise.all([
          apiService.getStats(),
          apiService.getBookings(),
          apiService.getAlerts()
        ]);
        if (statsRes.success) setStats(statsRes.data as Stats);
        if (bookingsRes.success) setRecentBookings((bookingsRes.data as Booking[]).slice(0, 4));
        if (alertsRes.success) setAlerts(alertsRes.data as Alert[]);



      } catch {
        console.error('Failed to load admin stats');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  const STAT_CARDS = [
    { label: 'Total Buses',           value: stats?.totalBuses || '0',    sub: 'Fleet Size',        icon: Bus,          color: '#facc15' },
    { label: 'Total Bookings',        value: stats?.totalBookings || '0', sub: 'Across All Hubs',   icon: Users,        color: '#38bdf8' },
    { label: 'Ticket Revenue',        value: `UGX ${(stats?.totalRevenue || 0).toLocaleString()}`, sub: 'Ticket Sales', icon: TicketCheck, color: '#4ade80' },
    { label: 'Delivery Revenue',      value: `UGX ${(stats?.totalDeliveryRevenue || 0).toLocaleString()}`, sub: 'Delivery Fees Collected', icon: Truck, color: '#a78bfa' },
    { label: 'Active Schedules',      value: stats?.activeSchedules || '0', sub: 'On Time',          icon: ShieldCheck,  color: '#fb923c' },
  ];

// Mock alerts removed - now fetched from API


  return (
    <div className="space-y-10 text-white">
      <header>
        <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">System Overview</h2>
        <p className="text-white/40 text-sm font-bold mt-1">Real-time TRANSPO HUB network status · {new Date().toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {STAT_CARDS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-zinc-800/60 border border-zinc-700 rounded-3xl p-6 space-y-4 hover:border-yellow-400/40 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 truncate">{s.label}</span>
              <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center" style={{ background: `${s.color}22` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
            </div>
            <div className="text-3xl xl:text-4xl font-black tracking-tighter truncate" style={{ color: s.color }}>{loading ? '...' : s.value}</div>
            <div className="text-[10px] font-bold text-white/30 uppercase truncate">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Presentation Control (Scenarios) */}
      <div className="bg-yellow-400 p-8 rounded-[40px] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
         <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-black uppercase italic tracking-tighter flex items-center gap-3">
               <Activity className="w-8 h-8" /> Presentation Mode: Live Scenarios
            </h3>
         </div>
         <p className="text-black/60 text-sm font-bold">Use these triggers to demonstrate system resilience and real-time monitoring capabilities during your final presentation.</p>
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => triggerScenario('battery_low')}
              disabled={scenarioLoading !== null}
              className={`bg-black text-white p-6 rounded-3xl flex items-center gap-4 transition-all group ${scenarioLoading === 'battery_low' ? 'opacity-70 scale-95' : 'hover:bg-zinc-800'}`}
            >
               <div className={`w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border-2 border-yellow-400 transition-transform ${scenarioLoading === 'battery_low' ? 'animate-pulse' : 'group-hover:scale-110'}`}>
                  <Zap className="w-6 h-6 text-yellow-400" />
               </div>
               <div className="text-left">
                  <div className="text-[10px] font-black uppercase opacity-40">Unit Event</div>
                  <div className="text-sm font-black uppercase">{scenarioLoading === 'battery_low' ? 'Triggering...' : 'Simulate Battery Failure'}</div>
               </div>
            </button>

            <button 
              onClick={() => triggerScenario('traffic_delay')}
              disabled={scenarioLoading !== null}
              className={`bg-black text-white p-6 rounded-3xl flex items-center gap-4 transition-all group ${scenarioLoading === 'traffic_delay' ? 'opacity-70 scale-95' : 'hover:bg-zinc-800'}`}
            >
               <div className={`w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border-2 border-yellow-400 transition-transform ${scenarioLoading === 'traffic_delay' ? 'animate-pulse' : 'group-hover:scale-110'}`}>
                  <Clock className="w-6 h-6 text-yellow-400" />
               </div>
               <div className="text-left">
                  <div className="text-[10px] font-black uppercase opacity-40">Route Event</div>
                  <div className="text-sm font-black uppercase">{scenarioLoading === 'traffic_delay' ? 'Triggering...' : 'Simulate Heavy Traffic'}</div>
               </div>
            </button>

            <button 
              onClick={() => triggerScenario('hub_congestion')}
              disabled={scenarioLoading !== null}
              className={`bg-black text-white p-6 rounded-3xl flex items-center gap-4 transition-all group ${scenarioLoading === 'hub_congestion' ? 'opacity-70 scale-95' : 'hover:bg-zinc-800'}`}
            >
               <div className={`w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border-2 border-yellow-400 transition-transform ${scenarioLoading === 'hub_congestion' ? 'animate-pulse' : 'group-hover:scale-110'}`}>
                  <Construction className="w-6 h-6 text-yellow-400" />
               </div>
               <div className="text-left">
                  <div className="text-[10px] font-black uppercase opacity-40">Hub Event</div>
                  <div className="text-sm font-black uppercase">{scenarioLoading === 'hub_congestion' ? 'Triggering...' : 'Trigger Hub Congestion'}</div>
               </div>
            </button>
         </div>
      </div>

      {/* Alerts + Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Alerts */}
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl p-8 space-y-4">
          <h3 className="font-black text-yellow-400 uppercase italic tracking-tighter text-xl flex items-center gap-3">
            <AlertCircle className="w-6 h-6" /> Live Alerts
          </h3>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="py-2 text-[10px] font-black uppercase text-white/20 tracking-widest text-center">No Active Alerts</div>
            ) : alerts.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border text-sm font-bold ${
                  a.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : a.severity === 'ok'    ? 'border-green-500/30 bg-green-500/10 text-green-300'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${a.severity === 'warning' ? 'bg-amber-400' : a.severity === 'ok' ? 'bg-green-400' : 'bg-blue-400'}`} />
                {a.message}
              </div>
            ))}

          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl p-8 space-y-4">
          <h3 className="font-black text-yellow-400 uppercase italic tracking-tighter text-xl flex items-center gap-3">
            <TrendingUp className="w-6 h-6" /> Recent Bookings
          </h3>
          <div className="space-y-3">
            {loading ? (
              <div className="py-10 text-center text-white/20 font-black uppercase tracking-widest text-xs">Synchronizing Manifest...</div>
            ) : recentBookings.length === 0 ? (
              <div className="py-10 text-center text-white/20 font-black uppercase tracking-widest text-xs">No Recent Activity</div>
            ) : recentBookings.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between py-3 border-b border-zinc-700/50 last:border-0"
              >
                <div>
                  <div className="font-black text-white text-sm">{b.passengerName}</div>
                  <div className="text-[10px] font-bold text-white/40 uppercase">Kampala → {b.destination}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-yellow-400">{b.id}</div>
                  <div className="text-[9px] font-bold text-white/20 uppercase">{b.departureTime}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>

      {/* System health */}
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-3xl p-8">
        <h3 className="font-black text-yellow-400 uppercase italic tracking-tighter text-xl flex items-center gap-3 mb-6">
          <Database className="w-6 h-6" /> Infrastructure Health
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { name: 'API Latency',    val: '12ms',   ok: true },
            { name: 'DB Connections', val: '428/512', ok: true },
            { name: 'Error Rate',     val: '0.02%',  ok: true },
            { name: 'Queue Depth',    val: '3 jobs',  ok: true },
          ].map(m => (
            <div key={m.name} className="space-y-2">
              <div className="text-[9px] font-black uppercase text-white/30 tracking-widest">{m.name}</div>
              <div className="text-2xl font-black text-white">{m.val}</div>
              <div className={`h-1.5 rounded-full ${m.ok ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
