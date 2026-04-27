'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Bus, 
  Clock, 
  ArrowRight, 
  Wifi, 
  User,
  Phone,
  CheckCircle2,
  QrCode,
  CreditCard,
  X,
  MapPin,
  Star
} from 'lucide-react';
import Link from 'next/link';
import { apiService } from '../../services/api';
import { useAuth } from '@/context/AuthContext';

interface Hub {
  id: string;
  name: string;
}

interface Schedule {
  id: string;
  busType: string;
  departureTime: string;
  destination: string;
  price: number;
  status: string;
}

interface Booking {
  id: string;
  scheduleId: string;
  userId: number;
  passengerName: string;
  phoneNumber: string;
  paymentStatus: string;
  totalAmount: number;
  travelDate?: string;
  destination?: string;
  departureTime?: string;
  busType?: string;
}

interface Departure {
  id: string;
  scheduleId: string;
  busId: string;
  hubId: string;
  travelDate: string;
  status: string;
  destination: string;
  departureTime: string;
  price: number;
  busType: string;
  busTag: string;
  seatCapacity: number;
  occupiedSeats: number;
  seatsAvailable: number;
  isSoldOut: boolean;
  scheduleStatus?: string;
}
 
interface Arrival {
  id: string;
  hubId: string;
  travelDate: string;
  departureTime: string;
  destination: string;
  status: string;
  expectedArrivalAt?: string | null;
  busTag?: string | null;
}

type BookingSchedule = Schedule & {
  departureId: string;
  travelDate: string;
  busTag: string;
  seatCapacity: number;
  seatsAvailable: number;
};

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string>('');

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [bookingSchedule, setBookingSchedule] = useState<BookingSchedule | null>(null);
  const [paymentStep, setPaymentStep] = useState(false);
  const [passengerInfo, setPassengerInfo] = useState({ name: '', phone: '', provider: 'MTN' });
  const [paymentMsg, setPaymentMsg] = useState('');
  const [ussdStep, setUssdStep] = useState<'none' | 'prompt' | 'processing' | 'success'>('none');
  const [time, setTime] = useState('');

  // Auto-fill user data
  useEffect(() => {
    if (user) {
      setPassengerInfo(prev => ({ ...prev, name: user.name, phone: user.phone }));
      
      // Load user bookings for dashboard summary
      async function loadUserActivity() {
        if (!user || user.id === undefined) return;
        try {
          const res = await apiService.getUserBookings(user.id);
          if (res.success) setUserBookings(res.data);
        } catch {
        }
      }
      loadUserActivity();
    }
  }, [user]);

  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 5000);
    
    async function tryLoadLive() {
      try {
        const hubsRes = await apiService.getHubs();
        if (hubsRes.success) setHubs(hubsRes.data || []);
        const depRes = await apiService.getDepartures({ startDate: selectedDate, includePast: true });
        if (depRes.success) setDepartures(depRes.data || []);
        const arrRes = await apiService.getArrivals({ startDate: selectedDate });
        if (arrRes.success) setArrivals(arrRes.data || []);
        if (hubsRes.success && depRes.success) setApiError('');
      } catch {
        setApiError('Backend unavailable. Active departures will appear after the admin adds live data.');
        setDepartures([]);
      }
    }
    tryLoadLive();
    return () => clearInterval(timer);
  }, [selectedDate, selectedHub?.id]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const depRes = await apiService.getDepartures({ hubId: selectedHub?.id, startDate: selectedDate, includePast: true });
        if (depRes?.success) setDepartures(depRes.data || []);
        const arrRes = await apiService.getArrivals({ hubId: selectedHub?.id, startDate: selectedDate });
        if (arrRes?.success) setArrivals(arrRes.data || []);
      } catch {
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedHub?.id, selectedDate]);

  const nextTrip = userBookings.find(b => b.paymentStatus === 'Completed' || b.paymentStatus === 'Pending');

  const handleHubSelect = async (hub: Hub | null) => {
    setSelectedHub(hub);
    setLoading(true);
    try {
      const res = await apiService.getDepartures({ hubId: hub?.id, startDate: selectedDate, includePast: true });
      if (res.success) {
        setDepartures(res.data || []);
        setApiError('');
      } else {
        setDepartures([]);
        setApiError(res.message || 'Unable to load departures');
      }
    } catch {
      setDepartures([]);
      setApiError('Backend unavailable. Active departures will appear after the admin adds live data.');
    } finally {
      setLoading(false);
    }
  };

  // Auth-gated booking opener — guests are redirected to /login
  const openBooking = (dep: Departure) => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Prohibit duplicate bookings for the same trip
    const alreadyBooked = userBookings.some(
      (b) => b.scheduleId === dep.scheduleId && (b.travelDate || 'Today') === dep.travelDate && b.paymentStatus !== 'Cancelled'
    );
    if (alreadyBooked) {
      alert("You already have a booking for this trip. Check your manifest in the 'Bookings' section.");
      return;
    }

    if (dep.isSoldOut) {
      alert('This bus is fully booked for the selected date. Please choose another date.');
      return;
    }

    setBookingSchedule({
      id: dep.scheduleId,
      busType: dep.busType,
      departureTime: dep.departureTime,
      destination: dep.destination,
      price: Number(dep.price),
      status: dep.scheduleStatus || dep.status,
      departureId: dep.id,
      travelDate: dep.travelDate,
      busTag: dep.busTag,
      seatCapacity: dep.seatCapacity,
      seatsAvailable: dep.seatsAvailable,
    });
  };

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentStep(true);
  };

  const handlePayment = async () => {
    if (!bookingSchedule || !user) return;
    setLoading(true);
    setUssdStep('prompt');
    
    try {
      // 1. Create the booking in "Pending" status
      const bookingRes = await apiService.createBooking({
        scheduleId: bookingSchedule.id,
        departureId: bookingSchedule.departureId,
        userId: user.id,
        passengerName: passengerInfo.name,
        phoneNumber: passengerInfo.phone,
        totalAmount: bookingSchedule.price,
        travelDate: bookingSchedule.travelDate
      });

      if (!bookingRes.success) {
        const suggested = bookingRes.alternatives?.suggestedDates?.length
          ? ` Suggested dates: ${bookingRes.alternatives.suggestedDates.join(', ')}`
          : '';
        throw new Error((bookingRes.message || 'Booking failed') + suggested);
      }

      // Simulate USSD delay
      await new Promise(r => setTimeout(r, 2000));
      setUssdStep('processing');

      // 2. Simulate payment processing
      const paymentRes = await apiService.processPayment({
        bookingId: bookingRes.data.id,
        phoneNumber: passengerInfo.phone,
        provider: passengerInfo.provider
      });

      if (!paymentRes.success) throw new Error(paymentRes.message);

      setUssdStep('success');
      setTimeout(() => {
        setUssdStep('none');
        setBookingSchedule(null);
        setPaymentStep(false);
        // Refresh bookings
        apiService.getUserBookings(user.id).then(res => {
          if (res.success) setUserBookings(res.data);
        });
        apiService.getDepartures({ hubId: selectedHub?.id, startDate: selectedDate }).then((res) => {
          if (res.success) setDepartures(res.data || []);
        });
      }, 3000);

    } catch (err: unknown) {
      const error = err as Error;
      setPaymentMsg('Error: ' + (error.message || 'Payment failed'));
      setUssdStep('none');

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      
      {/* USSD Simulation Overlay */}
      <AnimatePresence>
        {ussdStep !== 'none' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-100 border-4 border-black w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="bg-black text-white p-6 flex items-center justify-between">
                <span className="font-black text-xs uppercase tracking-widest">{passengerInfo.provider} MM SIMULATOR</span>
                <X className="w-5 h-5 cursor-pointer" onClick={() => setUssdStep('none')} />
              </div>
              
              <div className="p-8 space-y-6 text-center">
                {ussdStep === 'prompt' && (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-yellow-400 rounded-2xl mx-auto flex items-center justify-center border-4 border-black rotate-3">
                      <CreditCard className="w-8 h-8 text-black" />
                    </div>
                    <div className="font-black text-xl text-black">APPROVE PAYMENT?</div>
                    <p className="text-sm font-bold text-zinc-500">
                      Merchant: TRANSPO HUB<br/>
                      Amount: UGX {bookingSchedule?.price.toLocaleString()}<br/>
                      Phone: {passengerInfo.phone}
                    </p>
                    <div className="pt-4 grid grid-cols-2 gap-4">
                      <button onClick={() => setUssdStep('none')} className="py-4 rounded-xl border-4 border-black font-black uppercase text-xs">Cancel</button>
                      <button onClick={() => setUssdStep('processing')} className="py-4 rounded-xl bg-black text-white font-black uppercase text-xs">Confirm</button>
                    </div>
                  </div>
                )}

                {ussdStep === 'processing' && (
                  <div className="space-y-6 py-10">
                    <div className="w-16 h-16 border-8 border-yellow-400 border-t-black rounded-full mx-auto animate-spin" />
                    <div className="font-black text-lg uppercase tracking-widest text-black">Securing Funds...</div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Interfacing with National Switch</p>
                  </div>
                )}

                {ussdStep === 'success' && (
                  <div className="space-y-4 py-6">
                    <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center border-4 border-black animate-bounce">
                      <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                    <div className="font-black text-2xl text-black">PAYMENT OK</div>
                    <div className="text-xs font-black uppercase text-green-600 bg-green-50 py-2 rounded-lg">Transaction ID: TX-{Date.now().toString().slice(-8)}</div>
                    <p className="text-sm font-bold text-zinc-500">Boarding Pass Issued. Check your manifest.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <header className="flex flex-col md:flex-row items-baseline justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className="bg-black text-yellow-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-md">Sector Alpha</span>
             <h2 className="text-6xl font-black text-black tracking-tighter uppercase italic leading-none">
              {selectedHub ? selectedHub.name : 'Central Dispatch'} 
            </h2>
          </div>
          <div className="flex items-center gap-4 text-zinc-500 font-bold ml-1">
            <span className="flex items-center gap-2"><Clock className="w-5 h-5 text-black" /> {time}</span>
            <span className="w-2 h-2 bg-yellow-400 rounded-full border-2 border-black" />
            <span className="flex items-center gap-2 text-black"><Wifi className="w-5 h-5" /> Active Tracking</span>
          </div>
        </div>

        {user && (
          <div className="bg-yellow-400 border-4 border-black p-4 rounded-2xl flex items-center gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
             <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-yellow-400 font-black">
                {user.name.charAt(0)}
             </div>
             <div>
                <div className="text-[10px] font-black uppercase opacity-60">Welcome back</div>
                <div className="text-sm font-black uppercase">{user.name}</div>
             </div>
          </div>
        )}
      </header>

      {/* User Quick Stats / Next Trip */}
      {user && userBookings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="md:col-span-2 bg-black text-white p-8 rounded-[40px] border-4 border-yellow-400 relative overflow-hidden group">
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-yellow-400">Next Boarding Pass</h3>
                    <Link href="/bookings" className="text-[10px] font-black uppercase tracking-widest border-b-2 border-yellow-400 pb-1">View Manifest</Link>
                 </div>
                 
                 {nextTrip ? (
                   <div className="flex flex-col md:flex-row items-center gap-10 overflow-hidden">
                      <div className="space-y-1 overflow-hidden">
                         <div className="text-[10px] font-black uppercase opacity-40">Destination</div>
                         <div className="text-4xl font-black uppercase tracking-tighter italic truncate max-w-[200px] sm:max-w-[300px]">{nextTrip.destination}</div>
                      </div>
                      <div className="w-px h-12 bg-zinc-800 hidden md:block shrink-0" />
                      <div className="space-y-1 shrink-0">
                         <div className="text-[10px] font-black uppercase opacity-40">Departure</div>
                         <div className="text-2xl font-black">{nextTrip.departureTime}</div>
                      </div>
                      <div className="ml-auto">
                         <div className="bg-yellow-400 text-black px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl group-hover:scale-110 transition-transform">
                            {nextTrip.id}
                         </div>
                      </div>
                   </div>
                 ) : (
                   <p className="text-zinc-500 font-bold">No upcoming trips scheduled.</p>
                 )}
              </div>
              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
                 <QrCode className="w-40 h-40" />
              </div>
           </div>

           <div className="bg-white border-4 border-black p-8 rounded-[40px] flex flex-col justify-between shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="space-y-1">
                 <div className="text-[10px] font-black uppercase opacity-40 tracking-widest">Lifetime Travel</div>
                 <div className="text-5xl font-black italic tracking-tighter">{userBookings.length}</div>
                 <div className="text-xs font-bold text-zinc-400 uppercase">Trips Completed</div>
              </div>
              <div className="pt-4 flex items-center gap-2 text-green-600 font-black uppercase text-[10px] tracking-widest">
                 <CheckCircle2 className="w-4 h-4" /> Transit Pass Active
              </div>
           </div>
        </div>
      )}

      {/* Hub Selection - Primary Filter */}
      <div className="space-y-4">
        <label className="label-small ml-2">Select Regional Hub</label>
        {apiError ? (
          <div className="bg-yellow-100 border-4 border-black rounded-2xl p-4 font-black text-xs uppercase tracking-widest">
            {apiError}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => handleHubSelect(null)}
            className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${!selectedHub ? 'bg-black text-yellow-400 shadow-xl scale-105' : 'bg-white border-4 border-black text-black hover:bg-zinc-50'}`}
          >
            National Matrix
          </button>
          {hubs.map(hub => (
            <button 
              key={hub.id}
              onClick={() => handleHubSelect(hub)}
              className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${selectedHub?.id === hub.id ? 'bg-black text-yellow-400 shadow-xl scale-105' : 'bg-white border-4 border-black text-black hover:bg-zinc-50'}`}
            >
              {hub.name}
            </button>
          ))}
        </div>
      </div>

      {/* Departure Date (Today + next 2 days) */}
      <div className="space-y-4">
        <label className="label-small ml-2">Select Departure Date</label>
        <div className="flex flex-wrap gap-4">
          {[0, 1, 2].map((i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            const label = i === 0 ? 'Today' : d.toLocaleDateString();
            return (
              <button
                key={key}
                onClick={async () => {
                  setSelectedDate(key);
                  setLoading(true);
                  try {
                    const res = await apiService.getDepartures({ hubId: selectedHub?.id, startDate: key });
                    if (res?.success) setDepartures(res.data || []);
                  } finally {
                    setLoading(false);
                  }
                }}
                className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                  selectedDate === key ? 'bg-black text-yellow-400 shadow-xl scale-105' : 'bg-white border-4 border-black text-black hover:bg-zinc-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Schedule Feed */}
        <div className="lg:col-span-2 space-y-8">
           <h3 className="text-3xl font-black text-black flex items-center gap-6 uppercase italic tracking-tighter">
             <Bus className="w-10 h-10" />
             Active Departures
           </h3>

           <div className="grid grid-cols-1 gap-6">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white border-4 border-black p-6 rounded-[32px] shimmer">
                    <div className="h-20 bg-zinc-200 rounded-2xl" />
                  </div>
                ))
              ) : departures
                .filter((dep) => dep.travelDate === selectedDate)
                .filter((dep) => !selectedHub || dep.hubId === selectedHub.id)
                .map((dep) => {
                  const alreadyBooked = userBookings.some(
                    (b) => b.scheduleId === dep.scheduleId && (b.travelDate || 'Today') === dep.travelDate && b.paymentStatus !== 'Cancelled'
                  );
                  return (
                <div 
                  key={dep.id} 
                  className={`bg-white border-4 border-black p-2 rounded-[32px] overflow-hidden flex flex-col md:flex-row items-center gap-6 transition-transform cursor-pointer group ${
                    dep.isSoldOut ? 'opacity-70' : 'hover:translate-x-2'
                  }`}
                  onClick={() => openBooking(dep)}
                >
                  <div className="flex items-center gap-8 flex-1 w-full p-4 overflow-hidden">
                    <div className="w-20 h-20 bg-yellow-400 border-4 border-black rounded-[24px] flex flex-col items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-[10px] font-black uppercase tracking-widest">ID</span>
                      <span className="text-2xl font-black leading-none">#{dep.scheduleId.split('_')[1]}</span>
                    </div>
                    <div className="flex-1 space-y-2 overflow-hidden">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-[10px] font-black px-3 py-1.5 bg-black text-yellow-400 rounded-md uppercase tracking-tighter shrink-0">
                          {dep.busType}
                        </span>
                        <span className="text-[10px] font-black uppercase flex items-center gap-2 text-black truncate">
                           <div className="w-2 h-2 bg-black rounded-full shrink-0" /> Bus {dep.busTag}
                        </span>
                        <span className={`text-[10px] font-black uppercase flex items-center gap-2 shrink-0 ${
                          dep.isSoldOut ? 'text-red-600' : 'text-green-600'
                        }`}>
                           <div className={`w-2 h-2 rounded-full ${dep.isSoldOut ? 'bg-red-600' : 'bg-green-600 animate-pulse'}`} /> {dep.isSoldOut ? 'Sold Out' : `${dep.seatsAvailable}/${dep.seatCapacity} Seats`}
                        </span>
                      </div>
                      <div className="text-4xl font-black tracking-tighter flex items-center gap-4 flex-wrap overflow-hidden">
                        <span className="shrink-0">{dep.departureTime}</span>
                        <ArrowRight className="w-10 h-10 text-zinc-300 shrink-0" />
                        <span className="truncate max-w-[140px] sm:max-w-[200px]">{dep.destination}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-black text-yellow-400 p-8 md:min-w-[240px] flex flex-col items-center md:items-end justify-center gap-4">
                    <div className="text-right">
                       <span className="text-[10px] font-black uppercase opacity-60 block">Price</span>
                       <div className="text-3xl font-black tracking-tighter">UGX {Number(dep.price).toLocaleString()}</div>
                    </div>
                    <button 
                       disabled={alreadyBooked || dep.isSoldOut}
                       onClick={(e) => { e.stopPropagation(); openBooking(dep); }}
                       className={`w-full py-3 px-8 rounded-xl font-black text-xs uppercase tracking-widest border-2 border-white transition-colors flex items-center justify-center gap-2 ${
                         alreadyBooked || dep.isSoldOut ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-yellow-400 text-black hover:bg-white'
                       }`}
                     >
                       {!user && <span>🔒</span>}
                       {alreadyBooked ? 'Already Booked' : dep.isSoldOut ? 'Sold Out' : 'Book Pass'}
                     </button>
                  </div>
                </div>
                  );
                })}
           </div>
           </div>

        {/* Sidebar Mini-Module: Active Arrivals */}
        <div className="space-y-8">
           <h3 className="text-2xl font-black text-black uppercase italic tracking-tighter border-b-4 border-black pb-2">Active Arrivals</h3>
           
           <div className="space-y-4">
              {arrivals.length === 0 ? (
                <div className="card-premium bg-zinc-100 border-dashed">
                   <div className="py-12 text-center space-y-4">
                      <MapPin className="w-12 h-12 mx-auto text-zinc-300" />
                      <div className="font-black uppercase tracking-widest text-zinc-400">No Incoming Units</div>
                      <p className="text-[10px] font-bold text-zinc-300 px-8">Real-time arrival intelligence will appear when buses are en route.</p>
                   </div>
                </div>
              ) : (
                arrivals.map((arr) => (
                  <motion.div 
                    key={arr.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border-4 border-black p-6 rounded-[32px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3"
                  >
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase px-2 py-1 bg-black text-yellow-400 rounded">
                           {arr.busTag || 'BUS'}
                        </span>
                        <span className="text-[9px] font-black uppercase text-green-600 bg-green-50 px-2 py-1 rounded">
                           {arr.status}
                        </span>
                     </div>
                     <div className="text-xl font-black uppercase tracking-tighter">{arr.destination}</div>
                     <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {arr.departureTime}</span>
                        {arr.expectedArrivalAt && (
                          <span className="text-black">ETA: {new Date(arr.expectedArrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                     </div>
                  </motion.div>
                ))
              )}
           </div>

        </div>
      </div>

      {/* Booking Dialog Overlay */}
      <AnimatePresence>
        {bookingSchedule && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 pointer-events-none"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto" onClick={() => setBookingSchedule(null)} />
            
            <motion.div 
              initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
              className="w-full max-w-4xl bg-yellow-400 relative z-10 rounded-[48px] overflow-hidden pointer-events-auto border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] flex flex-col lg:flex-row"
            >
              <div className="flex-1 p-10 md:p-16 border-b-8 lg:border-b-0 lg:border-r-8 border-black">
                <div className="flex items-center justify-between mb-12">
                  <h3 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Issue Ticket</h3>
                  <button onClick={() => setBookingSchedule(null)} className="p-4 bg-black text-yellow-400 rounded-2xl hover:bg-zinc-800 transition-colors">
                    <X className="w-8 h-8" />
                  </button>
                </div>

                {!paymentStep ? (
                  <form onSubmit={handleBooking} className="space-y-10">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="label-small uppercase scale-110 mb-2">Authenticated Passenger</label>
                        <div className="relative">
                          <User className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-black/30" />
                          <input 
                            required type="text" placeholder="Full Name"
                            className="w-full bg-white border-4 border-black rounded-[24px] py-6 pl-18 pr-6 text-xl font-black focus:outline-none focus:bg-zinc-50" 
                            value={passengerInfo.name} onChange={e => setPassengerInfo({...passengerInfo, name: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="label-small uppercase scale-110 mb-2">MoMo Registration Number</label>
                        <div className="relative">
                          <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-black/30" />
                          <input 
                            required type="tel" placeholder="07... "
                            className="w-full bg-white border-4 border-black rounded-[24px] py-6 pl-18 pr-6 text-xl font-black focus:outline-none focus:bg-zinc-50" 
                            value={passengerInfo.phone} onChange={e => setPassengerInfo({...passengerInfo, phone: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <button className="w-full bg-black text-yellow-400 font-black py-8 rounded-[32px] text-2xl uppercase italic tracking-widest shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
                      Continue to Payment
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-6">
                    {!paymentMsg ? (
                      <div className="space-y-12">
                         <div>
                            <h4 className="text-4xl font-black text-black uppercase italic tracking-tighter mb-4">Finalizing Payment</h4>
                            <p className="text-sm font-bold opacity-60">Pushing request to {passengerInfo.phone}</p>
                         </div>
                        
                        <div className="flex gap-6">
                          <button 
                            onClick={() => setPassengerInfo({...passengerInfo, provider: 'MTN'})}
                            className={`flex-1 p-10 rounded-3xl border-8 transition-all ${passengerInfo.provider === 'MTN' ? 'border-black bg-white shadow-xl' : 'border-black/5 opacity-50 grayscale'}`}
                          >
                            <div className="font-black text-amber-500 text-3xl italic tracking-tighter">MTN</div>
                          </button>
                          <button 
                            onClick={() => setPassengerInfo({...passengerInfo, provider: 'Airtel'})}
                            className={`flex-1 p-10 rounded-3xl border-8 transition-all ${passengerInfo.provider === 'Airtel' ? 'border-black bg-white shadow-xl' : 'border-black/5 opacity-50 grayscale'}`}
                          >
                            <div className="font-black text-red-600 text-3xl italic tracking-tighter">AIRTEL</div>
                          </button>
                        </div>

                        <button onClick={handlePayment} className="w-full bg-white text-black border-4 border-black font-black py-8 rounded-[32px] text-2xl flex items-center justify-center gap-6 shadow-xl active:scale-95 transition-all uppercase italic">
                          <CreditCard className="w-10 h-10" /> Initializing Checkout
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-12">
                        <div className="w-32 h-32 bg-black text-yellow-400 rounded-full flex items-center justify-center mx-auto border-8 border-white shadow-2xl">
                          <CheckCircle2 className="w-16 h-16" />
                        </div>
                        <div className="space-y-4">
                           <h4 className="text-4xl font-black text-black uppercase italic tracking-tighter">{paymentMsg}</h4>
                           <p className="text-sm font-bold px-12 opacity-60">Your digital boarding pass has been registered to your account.</p>
                        </div>
                        <button onClick={() => { setBookingSchedule(null); setPaymentMsg(''); setPaymentStep(false); }} className="w-full bg-black text-white py-6 rounded-2xl font-black uppercase text-lg tracking-widest shadow-xl">
                          Return to Hub Matrix
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Digital Ticket View (Right Panel) */}
              <div className="hidden lg:flex w-[400px] bg-black p-12 items-center justify-center text-center relative overflow-hidden">
                 <div className="absolute inset-0 opacity-10 flex items-center justify-center">
                    <Bus className="w-[500px] h-[500px] text-yellow-400 -rotate-12" />
                 </div>
                 <div className="relative w-full aspect-[1/1.6] bg-yellow-400 rounded-[40px] p-8 text-black flex flex-col shadow-2xl border-4 border-white">
                    <div className="flex justify-between items-center mb-16 opacity-60">
                      <Bus className="w-8 h-8" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Boarding Pass</span>
                    </div>
                    
                    <div className="text-left mb-auto">
                      <div className="text-[10px] font-black uppercase opacity-60 mb-1">Route Vector</div>
                      <div className="text-5xl font-black tracking-tighter uppercase italic">{bookingSchedule.destination}</div>
                    </div>

                    <div className="space-y-8">
                       <div className="flex justify-between items-center py-6 border-y-4 border-black border-dashed">
                          <div className="text-left">
                             <div className="text-[10px] font-black uppercase opacity-60">Departure</div>
                             <div className="text-3xl font-black tracking-tighter uppercase">{bookingSchedule.departureTime}</div>
                          </div>
                          <div className="text-right">
                             <div className="text-[10px] font-black uppercase opacity-60">Seating</div>
                             <div className="text-3xl font-black tracking-tighter uppercase">X-12</div>
                          </div>
                       </div>
                       <div className="bg-white p-4 rounded-[32px] border-4 border-black shadow-inner">
                          <QrCode className="w-full h-full text-black" />
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
