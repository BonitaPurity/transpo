'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Bus, 
  LayoutDashboard, 
  History, 
  Activity,
  User,
  LogOut,
  ShieldAlert,
  PackageSearch,
  ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { name: 'Dashboard',    href: '/dashboard',  icon: LayoutDashboard },
  { name: 'My Bookings', href: '/bookings',   icon: History },
  { name: 'Live Tracking', href: '/monitoring', icon: Activity },
  { name: 'Movements', href: '/movements', icon: ArrowLeftRight },
  { name: 'Deliveries', href: '/deliveries', icon: PackageSearch },
  { name: 'Account', href: '/account', icon: User },
];

interface SidebarProps {
  closeMenu?: () => void;
}

export function Sidebar({ closeMenu }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  return (
    <aside className="w-full bg-black text-white flex flex-col h-full">
      <div className="p-6 xl:p-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center border-4 border-black rotate-3">
            <Bus className="text-black w-7 h-7" />
          </div>
          <span className="text-3xl font-black tracking-tighter text-yellow-400 uppercase">Transpo</span>
        </div>
        
        {closeMenu && (
          <button onClick={closeMenu} className="lg:hidden p-2 hover:bg-zinc-800 rounded-xl transition-colors">
             <LogOut className="w-6 h-6 rotate-180" /> {/* Using logout icon as a "close" back arrow visually */}
          </button>
        )}
      </div>

      <nav className="flex-1 px-6 space-y-3 overflow-y-auto overscroll-contain pb-6 custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              prefetch={false}
              onClick={closeMenu}
              className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
        {isAdmin && (
          <Link 
            href="/admin" 
            prefetch={false}
            onClick={closeMenu}
            className={`sidebar-link mt-6 border-t-2 border-yellow-400/20 pt-6 ${pathname.startsWith('/admin') ? 'sidebar-link-active' : ''}`}
          >
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            Admin Panel
          </Link>
        )}
      </nav>

      {/* User Session Area */}
      <div className="p-8 mt-auto">
        {user ? (
          <div className="bg-yellow-400 p-6 rounded-2xl border-4 border-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 mb-4 font-black uppercase text-xs">
              <User className="w-4 h-4" /> Transit Pass
            </div>
            <div className="mb-6">
              <div className="text-sm font-black uppercase truncate">{user.name}</div>
              <div className="text-[10px] font-bold opacity-70">{user.phone}</div>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2 bg-black text-yellow-400 rounded-xl font-black text-[10px] uppercase hover:bg-zinc-800 transition-colors"
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
        ) : (
          <Link 
            href="/login"
            prefetch={false}
            className="flex items-center justify-center gap-3 bg-yellow-400 text-black py-4 rounded-2xl font-black uppercase text-sm border-4 border-black hover:bg-yellow-300 transition-all hover:-translate-y-1 active:translate-y-0"
          >
            <User className="w-5 h-5" /> Sign In
          </Link>
        )}
        
        <div className="mt-8 flex items-center gap-2 opacity-30 justify-center">
           <ShieldAlert className="w-4 h-4" />
           <span className="text-[8px] font-black uppercase tracking-widest">Secure Dispatch Zone</span>
        </div>
      </div>
    </aside>
  );
}
