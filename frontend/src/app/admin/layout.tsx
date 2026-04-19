'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  LayoutDashboard,
  BookOpen,
  Truck,
  PackageSearch,
  Users,
  LogOut,
  ShieldAlert,
  Activity,
  AlertTriangle,
  Tag,
  BarChart3,
  CalendarDays,
} from 'lucide-react';

const ADMIN_NAV = [
  { name: 'Overview',         href: '/admin',            icon: LayoutDashboard },
  { name: 'All Bookings',    href: '/admin/bookings',   icon: BookOpen },
  { name: 'Fleet Manager',   href: '/admin/fleet',      icon: Truck },
  { name: 'Deliveries',      href: '/admin/deliveries', icon: PackageSearch },
  { name: 'Departures',      href: '/admin/departures', icon: CalendarDays },
  { name: 'Passenger DB',    href: '/admin/users',      icon: Users },
  { name: 'Fare Matrix',     href: '/admin/pricing',    icon: Tag },
  { name: 'Ops Intelligence',href: '/admin/metrics',    icon: BarChart3 },
  { name: 'Scenario Lab',    href: '/admin/scenario',   icon: Activity },
];


function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const isLogistics = user?.role === 'logistics_operator';

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <aside className="w-72 bg-zinc-950 text-white flex flex-col h-screen sticky top-0 border-r-4 border-yellow-400/30 shrink-0">
      {/* Logo */}
      <div className="px-8 py-8 border-b border-yellow-400/10">
        <div className="flex items-center gap-3 mb-1">
          <ShieldAlert className="w-6 h-6 text-yellow-400" />
          <span className="text-yellow-400 font-black tracking-tighter text-xl uppercase">Admin</span>
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/20">TRANSPO HUB · Control Room</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {(isLogistics ? ADMIN_NAV.filter((x) => x.href === '/admin/deliveries') : ADMIN_NAV).map(({ name, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                active
                  ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.2)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {name}
            </Link>
          );
        })}
      </nav>

      {/* Session */}
      <div className="p-6 border-t border-yellow-400/10 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-black font-black text-sm">
            {user?.name.charAt(0) ?? 'A'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-white uppercase truncate">{user?.name}</div>
            <div className="text-[9px] font-bold text-yellow-400/60 uppercase tracking-widest">System Admin</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLogistics = user?.role === 'logistics_operator';

  useEffect(() => {
    if (!isLoading && (!user || (!isAdmin && user.role !== 'logistics_operator'))) {
      router.replace('/login');
    }
  }, [user, isAdmin, isLoading, router]);

  useEffect(() => {
    if (!isLoading && user && user.role === 'logistics_operator' && pathname !== '/admin/deliveries') {
      router.replace('/admin/deliveries');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading || !user || (!isAdmin && user.role !== 'logistics_operator')) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-yellow-400 font-black uppercase animate-pulse text-xl">Verifying credentials...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-900">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin Header */}
        <header className="h-16 bg-zinc-950 border-b border-yellow-400/20 flex items-center px-8 justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">System Nominal · All Services Online</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 px-4 py-1.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">{isLogistics ? 'Logistics Mode Active' : 'Admin Mode Active'}</span>
          </div>
        </header>

        <main className="flex-1 p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
