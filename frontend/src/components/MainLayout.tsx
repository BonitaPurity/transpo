'use client';

import { useState } from 'react';
import { Menu, Zap } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { motion, AnimatePresence } from 'framer-motion';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative overflow-x-hidden bg-white text-black">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block shrink-0">
        <div className="sticky top-0 h-screen w-72 xl:w-80">
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
        <header className="sticky top-0 z-30 border-b-2 border-black bg-white">
          <div className="ui-container h-20 flex items-center justify-between gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="ui-icon-btn shrink-0 lg:hidden"
            >
               <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-3 h-3 shrink-0 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <span className="font-black text-xs sm:text-sm md:text-base tracking-wide uppercase truncate">
                Local Core Sync Active
              </span>
            </div>
          
            <div className="flex items-center gap-4 shrink-0">
               <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-black/70">Fleet Hub Uganda</div>
                  <div className="text-base font-black uppercase tracking-tight">Operational Nexus</div>
               </div>
               <div className="w-11 h-11 rounded-xl bg-yellow-400 border-2 border-black flex items-center justify-center">
                  <Zap className="w-6 h-6 text-black" />
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
