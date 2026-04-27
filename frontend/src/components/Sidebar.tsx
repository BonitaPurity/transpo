'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Bus,
  BusFront,
  CalendarClock,
  Database,
  LayoutDashboard,
  LineChart,
  Route,
  ShieldAlert,
  Tags,
  TicketCheck,
  Truck,
  User,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const userNavItems = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'My Bookings', href: '/bookings' },
  { name: 'Live Tracking', href: '/monitoring' },
  { name: 'Deliveries', href: '/deliveries' },
  { name: 'Account', href: '/account' },
];

const adminNavItems = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'All Bookings', href: '/admin/bookings', icon: TicketCheck },
  { name: 'Fleet Manager', href: '/admin/fleet', icon: BusFront },
  { name: 'Passenger DB', href: '/admin/users', icon: Database },
  { name: 'Departures', href: '/admin/departures', icon: CalendarClock },
  { name: 'Deliveries', href: '/admin/deliveries', icon: Truck },
  { name: 'Fare Matrix', href: '/admin/pricing', icon: Tags },
  { name: 'Ops Intelligence', href: '/admin/metrics', icon: LineChart },
  { name: 'Scenario Lab', href: '/admin/scenario', icon: Route },
];

interface SidebarProps {
  closeMenu?: () => void;
}

export function Sidebar({ closeMenu }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  return (
    <aside className="w-full bg-white text-black flex flex-col h-full border-r-2 border-black">
      <div className="p-6 xl:p-8 flex items-center justify-between border-b-2 border-black">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center border-2 border-black">
            <Bus className="text-black w-6 h-6" />
          </div>
          <span className="text-2xl sm:text-3xl font-black tracking-tight uppercase">Transpo</span>
        </div>
        
        {closeMenu && (
          <button onClick={closeMenu} className="ui-icon-btn lg:hidden">
             <LogOut className="w-6 h-6 rotate-180" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 sm:px-6 py-6 space-y-2 overflow-y-auto overscroll-contain custom-scrollbar">
        {userNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              prefetch={false}
              onClick={closeMenu}
              className={`min-h-11 px-4 rounded-xl flex items-center border-2 transition-colors font-black text-base ${
                isActive
                  ? 'bg-yellow-400 text-black border-black'
                  : 'bg-white text-black border-transparent hover:border-black hover:bg-zinc-50'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
        {isAdmin && (
          <div className="pt-6 mt-6 border-t-2 border-black/10 space-y-2">
            {adminNavItems.map((item) => {
              const isActive = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={closeMenu}
                  className={`min-h-11 px-4 rounded-xl flex items-center gap-3 border-2 transition-colors font-black text-base ${
                    isActive
                      ? 'bg-yellow-400 text-black border-black'
                      : 'bg-white text-black border-transparent hover:border-black hover:bg-zinc-50'
                  }`}
                >
                  <item.icon className="w-6 h-6 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Session Area */}
      <div className="p-6 sm:p-8 mt-auto border-t-2 border-black">
        {user ? (
          <div className="bg-yellow-400 p-6 rounded-2xl border-2 border-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 mb-4 font-black uppercase text-sm tracking-wide">
              <User className="w-6 h-6" /> Transit Pass
            </div>
            <div className="mb-6">
              <div className="text-base font-black uppercase truncate">{user.name}</div>
              <div className="text-sm font-semibold opacity-80">{user.phone}</div>
            </div>
            <button 
              onClick={logout}
              className="ui-btn w-full bg-black text-yellow-400 border-black hover:bg-zinc-900"
            >
              <LogOut className="w-6 h-6" /> Sign Out
            </button>
          </div>
        ) : (
          <Link 
            href="/login"
            prefetch={false}
            className="ui-btn-primary w-full"
          >
            <User className="w-6 h-6" /> Sign In
          </Link>
        )}
        
        <div className="mt-6 flex items-center gap-2 opacity-60 justify-center">
           <ShieldAlert className="w-6 h-6" />
           <span className="text-sm font-black uppercase tracking-wide">Secure Dispatch Zone</span>
        </div>
      </div>
    </aside>
  );
}
