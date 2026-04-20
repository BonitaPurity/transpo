'use client';

import { useState } from 'react';
import { Menu, Zap } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { motion, AnimatePresence } from 'framer-motion';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative overflow-x-hidden bg-white dark:bg-black">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block shrink-0 border-r-4 border-yellow-400">
        <div className="sticky top-0 h-screen w-64 xl:w-80">
          <Sidebar />
        </div>
      </div>

      {/* Sidebar - Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" 
               onClick={() => setIsSidebarOpen(false)} 
            />
            <motion.div 
               initial={{ x: -400 }} 
               animate={{ x: 0 }} 
               exit={{ x: -400 }}
               transition={{ type: 'spring', damping: 30, stiffness: 300 }}
               className="fixed inset-y-0 left-0 z-50 lg:hidden shadow-2xl"
            >
               <Sidebar closeMenu={() => setIsSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-black text-yellow-400 flex items-center px-6 lg:px-10 border-b-4 border-yellow-400 sticky top-0 z-30 justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-zinc-900 border-2 border-yellow-400/30 rounded-2xl hover:bg-zinc-800 transition-all active:scale-95"
            >
               <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <span className="font-black text-[10px] lg:text-xs tracking-widest uppercase whitespace-nowrap opacity-80">Local Core Sync Active</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-right hidden sm:block">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30 italic">Fleet Hub Uganda</div>
                <div className="text-xs font-black uppercase text-yellow-400 tracking-tighter">Operational Nexus 41</div>
             </div>
             <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
             </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-12 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
