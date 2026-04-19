'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, ShieldAlert, Bus, ArrowRight, ShieldCheck, Ticket } from 'lucide-react';
import { apiService } from '@/services/api';
import Link from 'next/link';

interface Booking {
  id: string;
  passengerName: string;
  destination: string;
  departureTime: string;
  busType?: string;
  createdAt: string;
  paymentStatus: string;
  travelDate?: string;
}

function ValidateContent() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const [ticket, setTicket] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function validateTicket() {
      if (!ticketId) {
        setError('No Ticket ID provided');
        setLoading(false);
        return;
      }

      try {
        const res = await apiService.getBookingById(ticketId);
        if (res.success && res.data) {
          setTicket(res.data);
        } else {
          setError('Ticket not found or invalid');
        }
      } catch {
        setError('Secure validation failed to connect to Transpo Hub.');
      } finally {
        setLoading(false);
      }
    }

    validateTicket();
  }, [ticketId]);

  if (loading) {
     return (
       <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-8 p-6 text-center">
         <div className="w-24 h-24 border-8 border-yellow-400 border-t-white rounded-full mx-auto animate-spin" />
         <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase text-white tracking-widest">Validating Pass</h1>
            <p className="text-yellow-400 font-bold uppercase tracking-widest text-xs">Querying National Database...</p>
         </div>
       </div>
     );
  }

  if (error || !ticket) {
     return (
       <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
         <div className="bg-zinc-900 border-4 border-red-500 rounded-[40px] max-w-md w-full p-12 space-y-8 shadow-[0_0_50px_-12px_rgba(239,68,68,0.5)]">
            <XCircle className="w-32 h-32 text-red-500 mx-auto animate-pulse" />
            <div className="space-y-4">
              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">Validation Failed</h1>
              <p className="text-zinc-400 font-bold">{error || 'This digital pass is unrecognized.'}</p>
            </div>
            
            <div className="bg-red-500/10 text-red-500 p-4 rounded-xl flex items-center gap-3 justify-center border-2 border-red-500/20">
               <ShieldAlert className="w-5 h-5 flex-shrink-0" />
               <span className="text-xs font-black uppercase tracking-widest text-left">Access Denied. Prevent Boarding.</span>
            </div>
         </div>
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5 flex items-center justify-center pointer-events-none">
         <ShieldCheck className="w-[800px] h-[800px] text-green-500" />
      </div>

      <div className="bg-yellow-400 border-8 border-white p-2 rounded-[48px] max-w-md w-full shadow-[0_0_80px_-12px_rgba(250,204,21,0.5)] relative z-10">
         <div className="bg-white rounded-[32px] overflow-hidden">
            <div className="bg-black p-8 text-yellow-400 flex items-center justify-between">
               <div>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Status</div>
                  <div className="text-sm font-black uppercase italic text-green-400 flex items-center gap-2">
                     VALID PASS <CheckCircle2 className="w-4 h-4" />
                  </div>
               </div>
               <Ticket className="w-8 h-8 opacity-50" />
            </div>

            <div className="p-8 space-y-8">
               <div className="text-center space-y-4 py-8">
                  <div className="w-32 h-32 bg-green-500 rounded-full mx-auto flex items-center justify-center border-8 border-black shadow-xl">
                      <CheckCircle2 className="w-16 h-16 text-white" />
                  </div>
                  <h1 className="text-5xl font-black uppercase italic tracking-tighter text-black">Verified</h1>
               </div>

               <div className="space-y-4 text-left border-y-4 border-dashed border-black/10 py-6">
                 <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Passenger</div>
                    <div className="text-2xl font-black text-black uppercase">{ticket.passengerName}</div>
                 </div>
                 
                 <div className="flex items-center gap-4 py-2">
                    <Bus className="w-8 h-8 text-black" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Route</div>
                      <div className="text-xl font-black text-black tracking-tight flex items-center gap-2 uppercase italic">
                         KAMPALA <ArrowRight className="w-4 h-4 text-yellow-400" /> {ticket.destination}
                      </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Dispatched</div>
                       <div className="text-lg font-black text-black">{ticket.travelDate || 'Today'}, {ticket.departureTime}</div>
                    </div>
                    <div className="text-right">
                       <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pass ID</div>
                       <div className="text-lg font-black text-black font-mono">{ticket.id}</div>
                    </div>
                 </div>
               </div>
               
               <div className="bg-green-50 border-4 border-green-500 rounded-2xl p-4 flex gap-3 text-left items-center">
                  <ShieldCheck className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-800">
                    This passenger is cleared for boarding. The digital signature is authentic.
                  </p>
               </div>
            </div>
         </div>
      </div>
      
      <div className="mt-8 text-center relative z-10">
         <Link href="/dashboard" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors border-b-2 border-zinc-800 pb-1 pb-1 hover:border-yellow-400 inline-block">
            Return to Transpo Hub Central Dashboard
         </Link>
      </div>
    </div>
  );
}

export default function ValidatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ValidateContent />
    </Suspense>
  );
}
