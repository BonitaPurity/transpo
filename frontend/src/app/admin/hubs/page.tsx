'use client';

import { motion } from 'framer-motion';
import { Building2, MapPin, ArrowUpRight, Settings, AlertCircle } from 'lucide-react';

const hubs = [
  {
    id: 'namanve', name: 'Namanve Hub', code: 'NMV', status: 'Optimal',
    capacity: '78%', capacityNum: 78, activeBays: 12, totalBays: 16,
    connections: 45, region: 'East Uganda', buses: 3, alert: null,
  },
  {
    id: 'busega', name: 'Busega Hub', code: 'BSG', status: 'Near Capacity',
    capacity: '92%', capacityNum: 92, activeBays: 8, totalBays: 10,
    connections: 32, region: 'West Uganda', buses: 3, alert: 'BSG-022 charging at low battery',
  },
  {
    id: 'kawempe', name: 'Kawempe Hub', code: 'KWP', status: 'Maintenance',
    capacity: '45%', capacityNum: 45, activeBays: 15, totalBays: 20,
    connections: 28, region: 'North Uganda', buses: 3, alert: 'Bay 7 offline for scheduled maintenance',
  },
];

export default function AdminHubs() {
  return (
    <div className="space-y-10 text-white">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">Regional Hub Control</h2>
          <p className="text-white/40 text-sm font-bold mt-1">Manage nexus terminals, bay allocation, and inter-hub routing.</p>
        </div>
        <button className="flex items-center gap-2 bg-yellow-400 text-black font-black text-xs uppercase py-3 px-6 rounded-2xl border-4 border-yellow-400 hover:bg-yellow-300 transition-all">
          <Settings className="w-4 h-4" /> Configure Hubs
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {hubs.map((hub, index) => {
          const statusColor = hub.status === 'Optimal' ? 'border-green-500'
            : hub.status === 'Near Capacity' ? 'border-amber-500' : 'border-red-500';
          const barColor = hub.capacityNum > 85 ? 'bg-red-500' : hub.capacityNum > 65 ? 'bg-amber-500' : 'bg-green-500';

          return (
            <motion.div
              key={hub.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-zinc-800/60 border-2 ${statusColor} rounded-3xl p-8 space-y-6 group hover:bg-zinc-800 transition-all`}
            >
              <div className="flex justify-between items-start">
                <div className="w-14 h-14 bg-yellow-400/10 border-2 border-yellow-400/30 rounded-2xl flex items-center justify-center group-hover:bg-yellow-400/20 transition-all">
                  <Building2 className="w-7 h-7 text-yellow-400" />
                </div>
                <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border ${
                  hub.status === 'Optimal' ? 'text-green-400 border-green-500/40 bg-green-500/10'
                  : hub.status === 'Near Capacity' ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                  : 'text-red-400 border-red-500/40 bg-red-500/10'
                }`}>
                  {hub.status}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-black bg-yellow-400 text-black px-2 py-0.5 rounded-md uppercase">{hub.code}</span>
                </div>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{hub.name}</h3>
                <div className="flex items-center gap-2 text-white/40 font-bold text-sm mt-1">
                  <MapPin className="w-4 h-4 text-yellow-400" /> {hub.region}
                </div>
              </div>

              {/* Capacity bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-white/40">
                  <span>Bay Load</span>
                  <span className="text-white">{hub.capacity}</span>
                </div>
                <div className="h-2.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: hub.capacity }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-700">
                <div>
                  <div className="text-[9px] font-black uppercase text-white/30">Bays</div>
                  <div className="text-xl font-black text-white">{hub.activeBays}<span className="text-xs text-white/30">/{hub.totalBays}</span></div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase text-white/30">Fleet</div>
                  <div className="text-xl font-black text-white">{hub.buses}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase text-white/30">Links</div>
                  <div className="text-xl font-black text-white">{hub.connections}</div>
                </div>
              </div>

              {hub.alert && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-300 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {hub.alert}
                </div>
              )}

              <button className="w-full py-3.5 border-2 border-yellow-400/20 text-yellow-400 font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-yellow-400/10 transition-all">
                Manage Hub <ArrowUpRight className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
