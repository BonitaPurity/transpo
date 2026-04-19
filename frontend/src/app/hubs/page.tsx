'use client';

import { motion } from 'framer-motion';
import { MapPin, Building2, Terminal, ArrowUpRight } from 'lucide-react';


const hubs = [
  { id: 'h1', name: 'Namanve Hub', status: 'Optimal', capacity: '78%', activeBays: 12, connections: 45 },
  { id: 'h2', name: 'Busega Hub', status: 'Near Capacity', capacity: '92%', activeBays: 8, connections: 32 },
  { id: 'h3', name: 'Kawempe Hub', status: 'Maintenance', capacity: '45%', activeBays: 15, connections: 28 },
];

export default function Hubs() {
  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <header className="space-y-4">
        <div className="flex items-center gap-3">
           <span className="bg-black text-yellow-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md">Logistics Network</span>
           <h2 className="text-5xl font-black text-black tracking-tighter uppercase italic py-1">Nexus Terminals</h2>
        </div>
        <p className="text-zinc-500 font-bold max-w-2xl text-lg leading-relaxed">
           Real-time capacity and operational status for regional transit gateways. Optimized for high-frequency dispatch.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {hubs.map((hub, index) => (
          <motion.div 
            key={hub.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card-premium group relative overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-2 h-full ${hub.status === 'Optimal' ? 'bg-green-500' : hub.status === 'Maintenance' ? 'bg-amber-500' : 'bg-red-500'}`} />
            
            <div className="space-y-8">
              <div className="flex justify-between items-start">
                <div className="w-16 h-16 bg-black text-yellow-400 rounded-2xl flex items-center justify-center border-4 border-yellow-400 transform group-hover:rotate-6 transition-transform">
                   <Building2 className="w-8 h-8" />
                </div>
                <div className="text-right">
                  <span className="label-small mb-1">Status</span>
                  <div className={`text-xs font-black uppercase tracking-widest ${hub.status === 'Optimal' ? 'text-green-600' : 'text-amber-600'}`}>
                    {hub.status}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-3xl font-black text-black tracking-tighter uppercase italic">{hub.name}</h3>
                <div className="flex items-center gap-2 text-zinc-400 font-bold mt-1">
                   <MapPin className="w-4 h-4 text-black" /> Regional Gateway
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y-4 border-black/5">
                <div>
                   <span className="label-small text-[9px]">Load</span>
                   <div className="text-2xl font-black text-black">{hub.capacity}</div>
                </div>
                <div>
                   <span className="label-small text-[9px]">Bays</span>
                   <div className="text-2xl font-black text-black">{hub.activeBays}</div>
                </div>
              </div>

              <button className="w-full py-4 bg-yellow-400 text-black border-4 border-black font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 group-hover:bg-black group-hover:text-yellow-400 transition-all">
                Access Terminal <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-6 flex items-center gap-2 opacity-10">
               <Terminal className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">SECURE_LINK_{index}01</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
