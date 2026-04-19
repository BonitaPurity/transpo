'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { useNotify } from '@/hooks/useNotify';
import { useSocket } from '@/context/SocketContext';
import { Phone, RefreshCw, X } from 'lucide-react';

interface DeliveryRow {
  trackingCode: string;
  receiverName: string;
  busId: string | null;
  busTag: string | null;
  destination: string | null;
  travelDate: string | null;
  enRouteStatus: 'En-route' | 'Arrived';
  arrived: boolean;
  arrivedAt: string | null;
  received: boolean;
  receivedAt: string | null;
}

interface ContactLookup {
  trackingCode: string;
  receiverName: string;
  receiverPhone: string;
  alternatePhone: string | null;
}

interface DeliveryUpdatePayload {
  trackingCode: string;
  arrived?: boolean;
  arrivedAt?: string | null;
  received?: boolean;
  receivedAt?: string | null;
}

function formatLocal(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function AdminDeliveriesPage() {
  const socket = useSocket();
  const { success: notifySuccess, error: notifyError } = useNotify();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contact, setContact] = useState<ContactLookup | null>(null);

  const refresh = async () => {
    setError('');
    const res = await apiService.getAdminDeliveries();
    if (!res?.success) {
      setError(res?.message || 'Failed to load deliveries');
      return;
    }
    setRows(res.data || []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (payload: DeliveryUpdatePayload) => {
      const tc = payload?.trackingCode;
      if (!tc) return;
      let found = false;
      setRows((prev) =>
        prev.map((r) => {
          if (r.trackingCode !== tc) return r;
          found = true;
          return {
            ...r,
            received: payload.received === true,
            receivedAt: payload.receivedAt || null,
            arrived: payload.arrived === true,
            arrivedAt: payload.arrivedAt || null,
            enRouteStatus: payload.arrived === true ? 'Arrived' : r.enRouteStatus,
          };
        })
      );
      if (!found) refresh().catch(() => {});
    };
    socket.on('delivery_update', onUpdate);
    return () => {
      socket.off('delivery_update', onUpdate);
    };
  }, [socket]);

  const summary = useMemo(() => {
    const total = rows.length;
    const arrived = rows.filter((r) => r.enRouteStatus === 'Arrived').length;
    const received = rows.filter((r) => r.received).length;
    return { total, arrived, received };
  }, [rows]);

  const openContact = async (trackingCode: string) => {
    setContactError('');
    setContact(null);
    setContactLoading(true);
    const res = await apiService.getAdminDeliveryContact(trackingCode);
    setContactLoading(false);
    if (!res?.success) {
      setContactError(res?.message || 'Failed to load contact');
      return;
    }
    setContact(res.data);
  };

  const setReceived = async (trackingCode: string, received: boolean, undo?: boolean) => {
    const res = await apiService.toggleAdminDeliveryReceived(trackingCode, received, { undo });
    if (!res?.success) {
      notifyError(res?.message || 'Failed to update status');
      return;
    }
    notifySuccess(received ? 'Marked as Received' : 'Marked as Not Received');
    await refresh();
  };

  return (
    <div className="space-y-8 text-white">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-4xl font-black text-yellow-400 uppercase italic tracking-tighter">Deliveries</div>
          <div className="text-white/40 text-sm font-bold">
            {summary.total} parcels · {summary.arrived} arrived · {summary.received} received
          </div>
        </div>
        <button
          onClick={() => refresh().catch(() => {})}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-black uppercase text-xs tracking-widest border border-white/10"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-200 font-bold text-sm">{error}</div>
      ) : null}

      <div className="bg-zinc-950 border border-yellow-400/20 rounded-3xl overflow-hidden">
        <div className="grid grid-cols-5 gap-3 px-6 py-4 border-b border-white/10 text-[9px] font-black uppercase tracking-widest text-white/30">
          <div>Tracking</div>
          <div>Receiver</div>
          <div>Bus</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-center text-white/20 font-black uppercase tracking-widest text-xs">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-white/20 font-black uppercase tracking-widest text-xs">No parcels</div>
        ) : (
          <div className="divide-y divide-white/10">
            {rows.map((r) => (
              <div key={r.trackingCode} className="grid grid-cols-5 gap-3 px-6 py-4 items-center">
                <button onClick={() => openContact(r.trackingCode)} className="text-left font-black text-yellow-300 hover:text-yellow-200">
                  {r.trackingCode}
                </button>
                <div className="font-bold text-white/80 truncate">{r.receiverName}</div>
                <div>
                  <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest">
                    {r.busTag || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      r.enRouteStatus === 'Arrived'
                        ? 'bg-green-500/15 text-green-300 border-green-500/30'
                        : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    }`}
                    title={r.arrivedAt ? `Arrived at ${formatLocal(r.arrivedAt)}` : undefined}
                  >
                    {r.enRouteStatus}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => openContact(r.trackingCode)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                    aria-label="View contact"
                    title="View contact"
                  >
                    <Phone className="w-4 h-4 text-white/70" />
                  </button>

                  {r.received ? (
                    <>
                      <span className="px-3 py-1.5 rounded-full bg-yellow-400 text-black text-[10px] font-black uppercase tracking-widest">
                        Received
                      </span>
                      <button
                        onClick={() => setReceived(r.trackingCode, false, true)}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest"
                      >
                        Undo
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setReceived(r.trackingCode, true)}
                      className="px-4 py-2 rounded-xl bg-yellow-400 text-black font-black text-[10px] uppercase tracking-widest"
                    >
                      Mark Received
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(contactLoading || contactError || contact) ? (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={() => { setContact(null); setContactError(''); setContactLoading(false); }}>
          <div className="w-full max-w-xl bg-white border-4 border-black rounded-[32px] p-8 text-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Receiver Contact</div>
                <div className="text-2xl font-black uppercase tracking-tighter">{contact?.trackingCode || 'Loading...'}</div>
              </div>
              <button
                onClick={() => { setContact(null); setContactError(''); setContactLoading(false); }}
                className="p-2 rounded-xl border-4 border-black bg-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {contactError ? (
              <div className="bg-red-50 border-4 border-black rounded-2xl p-4 font-black text-xs uppercase tracking-widest text-red-700">{contactError}</div>
            ) : null}
            {contactLoading ? (
              <div className="bg-zinc-100 border-4 border-black rounded-2xl p-6 font-black text-xs uppercase tracking-widest text-zinc-500">Loading...</div>
            ) : null}

            {contact ? (
              <div className="space-y-4">
                <div className="border-4 border-black rounded-2xl p-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Receiver</div>
                  <div className="text-lg font-black">{contact.receiverName}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-4 border-black rounded-2xl p-4 space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Primary Phone</div>
                    <a className="font-black underline" href={`tel:${contact.receiverPhone}`}>{contact.receiverPhone}</a>
                  </div>
                  <div className="border-4 border-black rounded-2xl p-4 space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Alternate Phone</div>
                    {contact.alternatePhone ? (
                      <a className="font-black underline" href={`tel:${contact.alternatePhone}`}>{contact.alternatePhone}</a>
                    ) : (
                      <div className="font-black text-zinc-400">—</div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
