'use client';

import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  CloudRain, 
  WifiOff, 
  RotateCcw, 
  Activity, 
  ShieldAlert, 
  Terminal,
  Clock,
  Navigation
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/hooks/useNotify';
import { apiService } from '@/services/api';

interface ScenarioLog {
  id: string;
  time: string;
  event: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  severity: string;
}



const SCENARIOS: Scenario[] = [
  {
    id: 'weather_emergency',
    name: 'Weather Emergency',
    description: 'Trigger global torrential rain. All en-route buses restricted to 40% speed.',
    icon: CloudRain,
    color: 'text-blue-400',
    severity: 'Warning'
  },
  {
    id: 'hub_offline',
    name: 'Hub Power Failure',
    description: 'Simulate a total power blackout at Namanve Hub. Stops all charging services.',
    icon: WifiOff,
    color: 'text-red-400',
    severity: 'Critical'
  },
  {
    id: 'battery_low',
    name: 'Battery Critical',
    description: 'Force a specific unit to report 12% battery to test AI routing response.',
    icon: Zap,
    color: 'text-yellow-400',
    severity: 'Standard'
  },
  {
    id: 'traffic_delay',
    name: 'Gridlock Simulation',
    description: 'Inject massive traffic delays into the Central Business District routes.',
    icon: Clock,
    color: 'text-amber-400',
    severity: 'Advisory'
  }
];


export default function ScenarioLab() {
  const { user } = useAuth();
  const { success, error } = useNotify();
  const [loading, setLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<ScenarioLog[]>([]);
  const [activeSystem, setActiveSystem] = useState('Nominal');

  const addLog = (event: string, type: ScenarioLog['type'] = 'info') => {
    const newLog: ScenarioLog = {
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString(),
      event,
      type
    };
    setLogs(prev => [newLog, ...prev].slice(0, 10));
  };

  const triggerScenario = async (id: string) => {
    if (!user?.email) return;
    setLoading(id);
    addLog(`Initializing scenario sequence: ${id.replace('_', ' ').toUpperCase()}`, 'info');

    try {
      const data = await apiService.triggerScenario(id);
      
      if (data.success) {
        success(`${id} scenario activated!`);
        addLog(`COMMAND_SUCCESS: ${data.message}`, 'success');
        if (id === 'reset') setActiveSystem('Nominal');
        else setActiveSystem('Alert Active');
      } else {
        error(data.message || 'Sequence aborted');
        addLog(`COMMAND_ERROR: ${data.message}`, 'error');
      }
    } catch {
      error('Interface communication failure.');
      addLog('FATAL: Backend unreachable', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row items-baseline justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className="bg-red-600 text-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-md animate-pulse">Classified Access</span>
             <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">Scenario Lab</h2>
          </div>
          <p className="text-white/40 font-bold max-w-2xl text-lg leading-relaxed">
            Strategic Simulation Environment. Stress-test the TRANSPO HUB digital twin with real-world operational challenges.
          </p>
        </div>

        <button 
          onClick={() => triggerScenario('reset')}
          disabled={loading !== null}
          className="bg-yellow-400 border-4 border-black p-6 rounded-[32px] flex items-center gap-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all active:scale-95 group"
        >
           <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-yellow-400 group-hover:rotate-180 transition-transform duration-500">
              <RotateCcw className="w-6 h-6" />
           </div>
           <div>
              <div className="text-[10px] font-black uppercase opacity-60">Emergency Protocol</div>
              <div className="text-xl font-black uppercase text-black">System Reset</div>
           </div>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Scenario Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {SCENARIOS.map((s, i) => (
            <motion.div 
              key={s.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-zinc-800/40 border border-white/5 rounded-[40px] p-8 space-y-8 group hover:border-yellow-400/40 transition-all hover:bg-zinc-800/60"
            >
              <div className="flex justify-between items-start">
                <div className={`p-5 rounded-3xl bg-zinc-900 border-2 border-white/5 ${s.color} group-hover:scale-110 transition-transform`}>
                  <s.icon className="w-8 h-8" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-20">Type</div>
                  <div className={`text-xs font-black uppercase ${s.color}`}>{s.severity}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase text-white tracking-tighter italic">{s.name}</h3>
                <p className="text-xs font-bold text-white/40 leading-relaxed">{s.description}</p>
              </div>

              <button 
                onClick={() => triggerScenario(s.id)}
                disabled={loading !== null}
                className="w-full py-5 bg-white text-black font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-yellow-400 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading === s.id ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Execute Sequence <Navigation className="w-4 h-4" /></>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Right: Operations Terminal */}
        <div className="space-y-8">
          <div className="bg-black border-4 border-yellow-400/20 rounded-[48px] p-1 shadow-2xl overflow-hidden">
            <div className="bg-zinc-900 rounded-[44px] p-8 space-y-8">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Secure Console</span>
                  </div>
                  <Terminal className="w-5 h-5 text-white/20" />
               </div>

               <div className="space-y-6">
                  <div className="p-6 bg-black rounded-3xl border border-white/5 space-y-1">
                     <div className="text-[10px] font-black uppercase text-white/20">System Status</div>
                     <div className={`text-3xl font-black uppercase tracking-tighter italic ${activeSystem === 'Nominal' ? 'text-green-500' : 'text-red-500'}`}>
                        {activeSystem}
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="text-[10px] font-black uppercase tracking-widest text-white/20 px-2 flex justify-between">
                        <span>Terminal Output</span>
                        <Activity className="w-3 h-3" />
                     </div>
                     <div className="bg-black rounded-3xl p-6 min-h-[300px] border border-white/5 font-mono text-[10px] space-y-3">
                        <AnimatePresence>
                           {logs.length === 0 ? (
                             <div className="text-white/20 italic">Waiting for command...</div>
                           ) : logs.map((log) => (
                             <motion.div 
                               key={log.id}
                               initial={{ opacity: 0, x: -10 }}
                               animate={{ opacity: 1, x: 0 }}
                               className="flex gap-3"
                             >
                                <span className="text-white/20 shrink-0">[{log.time}]</span>
                                <span className={
                                  log.type === 'success' ? 'text-green-500' :
                                  log.type === 'error' ? 'text-red-500' :
                                  log.type === 'warning' ? 'text-yellow-400' : 'text-white/60'
                                }>
                                   {log.event}
                                </span>
                             </motion.div>
                           ))}
                        </AnimatePresence>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          <div className="bg-zinc-800/40 border border-white/5 rounded-[40px] p-8 flex items-center gap-6">
             <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center border-4 border-black rotate-3">
                <ShieldAlert className="w-8 h-8 text-black" />
             </div>
             <div>
                <div className="text-xs font-black uppercase text-white underline decoration-yellow-400">Ops Intelligence</div>
                <p className="text-[10px] font-bold text-white/40 leading-relaxed uppercase tracking-tighter mt-1">
                   Executed scenarios appear as active challenges in the Ops Intelligence tab. Use System Reset to clear all scenario challenges. Live tracking is unaffected.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
