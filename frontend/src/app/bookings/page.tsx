'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Search, ShieldCheck, Ticket, User, ArrowRight, X, CheckCircle2, Share, Navigation } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';

interface Booking {
  id: string;
  passengerName: string;
  destination: string;
  departureTime: string;
  busType?: string;
  createdAt: string;
  travelDate: string;
  paymentStatus: string;
}


export default function Bookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTicket, setShowTicket] = useState<Booking | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | ''>('');



  const handleShare = async (booking: Booking) => {
    const shareData = {
      title: 'TRANSPO HUB - Boarding Pass',
      text: `Here is my Transpo Hub Boarding Pass for the bus to ${booking.destination} at ${booking.departureTime}. Pass ID: ${booking.id}`,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing', err);
      }
    } else {
      navigator.clipboard.writeText(shareData.text);
      alert('Boarding pass details copied to clipboard!');
    }
  };

  const handleShowTicket = async (bookingId: string) => {
    try {
      const res = await apiService.getBookingById(bookingId);
      if (res.success) {
        setShowTicket(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch ticket details', err);
    }
  };

  // Scanner logic removed per user request
  useEffect(() => {
    async function loadUserBookings() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiService.getUserBookings(user.id);
        if (res.success) setBookings(res.data);
      } catch (err) {
        console.error('Failed to load user bookings', err);
      } finally {
        setLoading(false);
      }
    }
    loadUserBookings();
  }, [user]);

  const hasUser = !!user;

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      
      {/* Scanner Modal removed per request */}

      {/* Boarding Pass Ticket Modal */}
      <AnimatePresence>
        {showTicket && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
            onClick={() => setShowTicket(null)}
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-sm bg-yellow-400 rounded-[48px] p-1 border-8 border-black shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-[40px] overflow-hidden flex flex-col">
                <div className="bg-black text-yellow-400 p-8 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Ticket Status</div>
                    <div className="text-sm font-black uppercase italic">Valid For Boarding</div>
                  </div>
                  <Ticket className="w-8 h-8 rotate-12" />
                </div>

                <div className="p-8 space-y-8 flex-1">
                  <div className="text-center space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Route Vector</div>
                    <h3 className="text-4xl font-black text-black tracking-tighter uppercase italic leading-none">
                      KAMPALA <ArrowRight className="inline-block w-8 h-8 text-yellow-400 mx-2" /> {showTicket.destination}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-6 py-6 border-y-4 border-black/5 border-dashed">
                    <div>
                      <div className="text-[9px] font-black uppercase text-zinc-400">Departure</div>
                      <div className="text-xl font-black text-black">{showTicket.departureTime}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black uppercase text-zinc-400">Pass ID</div>
                      <div className="text-xl font-black text-black font-mono">{showTicket.id}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="aspect-square bg-white border-4 border-black p-5 rounded-3xl shadow-inner relative group flex items-center justify-center">
                       <QRCode value={typeof window !== 'undefined' ? `${window.location.origin}/validate?ticketId=${showTicket.id}` : showTicket.id} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                       <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/80">
                          <CheckCircle2 className="w-16 h-16 text-green-500" />
                       </div>
                    </div>
                    <div className="text-center">
                       <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Encrypted Transpo-ID. Scan at Hub.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50 p-6 flex items-center justify-between gap-4 border-t-4 border-black/5">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-yellow-400" />
                     </div>
                     <div className="text-[10px] font-black uppercase tracking-tighter">Verified Digital Asset</div>
                   </div>
                   <button
                     onClick={() => setShowTicket(null)}
                     className="flex items-center gap-2 px-5 py-3 bg-black text-white font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-zinc-800 transition-colors border-2 border-black shrink-0"
                   >
                     <X className="w-4 h-4" /> Close
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b-8 border-black">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <Ticket className="w-10 h-10 text-yellow-400 fill-black" />
             <h2 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Manifest Archive</h2>
          </div>
          <p className="text-zinc-500 font-bold ml-1">Personal transit logs and issued boarding passes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-zinc-100 border-4 border-black p-3 rounded-2xl flex items-center gap-3 px-6">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input type="text" placeholder="Search pass ID..." className="bg-transparent font-bold outline-none uppercase text-xs w-32" />
          </div>
          <button
            onClick={async () => {
              if (!user?.id) return;
              setExporting('csv');
              try {
                await apiService.downloadUserBookingsExport(user.id, 'csv');
              } finally {
                setExporting('');
              }
            }}
            disabled={!user?.id || !!exporting}
            className="px-5 py-4 bg-yellow-400 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black uppercase tracking-widest text-xs hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-60 whitespace-nowrap"
          >
            {exporting === 'csv' ? 'Downloading…' : 'Download CSV'}
          </button>
          <button
            onClick={async () => {
              if (!user?.id) return;
              setExporting('pdf');
              try {
                await apiService.downloadUserBookingsExport(user.id, 'pdf');
              } finally {
                setExporting('');
              }
            }}
            disabled={!user?.id || !!exporting}
            className="px-5 py-4 bg-black text-yellow-400 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black uppercase tracking-widest text-xs hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-60 whitespace-nowrap"
          >
            {exporting === 'pdf' ? 'Downloading…' : 'Download PDF'}
          </button>
        </div>
      </header>

      {hasUser ? (
        <div className="space-y-8">
           <div className="grid grid-cols-1 gap-6">
              {loading ? (
                <div className="py-20 text-center font-black uppercase tracking-widest text-zinc-300 animate-pulse">Retrieving Manifest...</div>
              ) : bookings.length === 0 ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center mx-auto border-4 border-black border-dashed">
                    <History className="w-8 h-8 text-zinc-300" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase italic">No Transit History</h3>
                    <p className="text-zinc-400 font-bold max-w-xs mx-auto">You haven&apos;t booked any trips yet. Start your journey today!</p>

                  </div>
                  <Link href="/dashboard" className="inline-flex items-center gap-2 bg-black text-yellow-400 px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all">
                    Book Now <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              ) : bookings.map((booking, index) => (
                <motion.div 
                   key={booking.id}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: index * 0.1 }}
                   className="card-premium group"
                >
                   <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                      <div className="w-20 h-20 shrink-0 bg-yellow-400 border-4 border-black rounded-3xl flex flex-col items-center justify-center rotate-2 shadow-lg group-hover:rotate-0 transition-transform">
                         <div className="text-[9px] font-black uppercase opacity-60">ID</div>
                         <div className="text-sm font-black leading-tight text-center px-1 break-all">{booking.id}</div>
                      </div>
                      
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full min-w-0">
                         <div className="min-w-0">
                            <span className="label-small">Traveler</span>
                            <div className="font-black text-black uppercase truncate">{booking.passengerName}</div>
                         </div>
                         <div className="min-w-0">
                            <span className="label-small">Route</span>
                            <div className="font-black text-black uppercase tracking-tight truncate">Kampala ➔ {booking.destination}</div>
                         </div>
                         <div className="min-w-0">
                            <span className="label-small">Schedule</span>
                            <div className="font-black text-black uppercase truncate">{booking.travelDate}</div>
                            <div className="font-black text-black uppercase text-sm truncate">at {booking.departureTime}</div>
                         </div>
                         <div className="min-w-0">
                            <span className="label-small">Status</span>
                            <div className={`font-black uppercase text-xs flex items-center gap-2 ${booking.paymentStatus === 'Completed' ? 'text-green-600' : 'text-amber-500'}`}>
                               <div className="w-2 h-2 bg-current rounded-full shrink-0" /> {booking.paymentStatus}
                            </div>
                         </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                         {booking.paymentStatus === 'Completed' && (
                           <button 
                             onClick={() => handleShare(booking)}
                             className="px-4 py-3 bg-zinc-100 text-black font-black rounded-xl text-[10px] uppercase border-2 border-black tracking-widest hover:scale-105 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none flex items-center gap-2 whitespace-nowrap"
                           >
                             <Share className="w-4 h-4" /> Forward
                           </button>
                         )}
                          <Link 
                              href="/monitoring"
                              className="px-4 py-3 bg-yellow-400 text-black font-black rounded-xl text-[10px] uppercase border-2 border-black tracking-widest hover:scale-105 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none flex items-center gap-2 whitespace-nowrap"
                            >
                              <Navigation className="w-4 h-4" /> Track Live
                          </Link>
                          <button 
                             onClick={() => handleShowTicket(booking.id)}
                             className="px-6 py-3 bg-black text-yellow-400 font-black rounded-xl text-[10px] uppercase border-2 border-white tracking-widest hover:bg-zinc-800 transition-colors whitespace-nowrap"
                           >
                             Show Ticket
                           </button>
                      </div>
                   </div>
                </motion.div>
              ))}
           </div>
           
           <div className="p-10 text-center border-4 border-dashed border-zinc-200 rounded-[40px] bg-zinc-50">
              <ShieldCheck className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Encryption layer active: All manifest data is secured.</p>
           </div>
        </div>
      ) : (
        <div className="py-20 text-center space-y-8">
           <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mx-auto border-4 border-dashed border-zinc-300">
              <User className="w-10 h-10 text-zinc-300" />
           </div>
           <div className="max-w-md mx-auto space-y-4">
              <h3 className="text-3xl font-black uppercase italic tracking-tighter">Restricted Access</h3>
              <p className="text-zinc-400 font-bold">Please authorize your session to view your personal transit manifest.</p>
              <div className="pt-4">
                 <Link href="/login" className="bg-black text-yellow-400 px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all inline-block">
                    Authorize Session
                 </Link>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
