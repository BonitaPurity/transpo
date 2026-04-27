'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { PackageSearch, Search, Truck, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface Delivery {
  id?: string;
  trackingCode: string;
  receiverName: string;
  receiverPhone: string;
  status: string;
  paymentStatus?: string;
  arrived?: boolean;
  arrivedAt?: string | null;
  received?: boolean;
  receivedAt?: string | null;
  feeAmount?: number;
  travelDate?: string | null;
  destination?: string | null;
  description?: string | null;
  contacts?: { name: string; phone: string }[];
  trip?: {
    expectedArrivalAt?: string | null;
    status?: string;
    departureTime?: string;
  } | null;
}

interface DepartureOption {
  id: string;
  travelDate: string;
  departureTime: string;
  destination: string;
  busTag: string;
  busId: string;
  hubId: string;
}

interface DeliveryUpdatePayload {
  trackingCode: string;
  status: string;
  paymentStatus?: string;
  arrived?: boolean;
  arrivedAt?: string | null;
  received?: boolean;
  receivedAt?: string | null;
}

export default function DeliveriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const socket = useSocket();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Delivery | null>(null);

  const localDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState<string>(localDateKey(new Date()));
  const [departures, setDepartures] = useState<DepartureOption[]>([]);
  const [departureId, setDepartureId] = useState('');
  const [quoteFee, setQuoteFee] = useState<number>(10000);

  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [description, setDescription] = useState('');
  const [contacts, setContacts] = useState<Array<{ name: string; phone: string }>>([{ name: '', phone: '' }]);

  const [paymentPhone, setPaymentPhone] = useState('');
  const [provider, setProvider] = useState<'MTN' | 'Airtel'>('MTN');
  const [createdDeliveryId, setCreatedDeliveryId] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([]);

  const printTrackingLabel = (tc: string) => {
    const labelTitle = `TRANSPO DELIVERY LABEL`;
    const html = `
      <html>
        <head>
          <title>${labelTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            .box { border: 6px solid #000; padding: 20px; border-radius: 18px; }
            .title { font-weight: 900; letter-spacing: 2px; font-size: 12px; text-transform: uppercase; color: #111; }
            .code { font-size: 42px; font-weight: 900; margin: 14px 0; letter-spacing: 2px; }
            .meta { font-size: 14px; font-weight: 700; color: #222; line-height: 1.6; }
            .hint { font-size: 11px; font-weight: 800; text-transform: uppercase; opacity: 0.7; margin-top: 14px; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="title">${labelTitle}</div>
            <div class="code">${tc}</div>
            <div class="meta">
              Destination: ${departures.find((d) => d.id === departureId)?.destination || '—'}<br/>
              Travel date: ${selectedDate}<br/>
              Receiver: ${receiverName || '—'} (${receiverPhone || '—'})<br/>
            </div>
            <div class="hint">Attach this label to the parcel before dispatch</div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>`;
    const w = window.open('', '_blank', 'width=720,height=800');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const dateOptions = useMemo(() => {
    return [0, 1, 2].map((i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return { key: localDateKey(d), label: i === 0 ? 'Today' : d.toLocaleDateString() };
    });
  }, []);

  useEffect(() => {
    setPaymentPhone(user?.phone || '');
  }, [user?.phone]);

  useEffect(() => {
    async function loadDepartures() {
      try {
        const res = await apiService.getDepartures({ startDate: selectedDate });
        if (!res.success) return;
        const list = (res.data || []).filter((d: DepartureOption) => d.travelDate === selectedDate);
        setDepartures(list);
      } catch {
      }
    }
    loadDepartures();
  }, [selectedDate]);

  useEffect(() => {
    async function loadMine() {
      if (!user?.id) return;
      try {
        const res = await apiService.getMyDeliveries();
        if (res?.success) setMyDeliveries(res.data || []);
      } catch {
      }
    }
    loadMine();
  }, [user?.id, trackingCode]);

  useEffect(() => {
    if (!socket) return;
    const onDeliveryUpdate = (payload: DeliveryUpdatePayload) => {
      const tc = payload?.trackingCode;
      if (!tc) return;
      let found = false;
      setMyDeliveries((prev) =>
        prev.map((d) => {
          if (d.trackingCode !== tc) return d;
          found = true;
          return { ...d, status: payload.status, paymentStatus: payload.paymentStatus, arrivedAt: payload.arrivedAt || d.arrivedAt, receivedAt: payload.receivedAt || d.receivedAt };
        })
      );
      setResult((prev) => (prev?.trackingCode === tc ? { ...prev, status: payload.status, paymentStatus: payload.paymentStatus, arrivedAt: payload.arrivedAt || prev.arrivedAt, receivedAt: payload.receivedAt || prev.receivedAt } : prev));
      if (!found && user?.id) {
        apiService.getMyDeliveries().then((res) => {
          if (res?.success) setMyDeliveries(res.data || []);
        }).catch(() => {});
      }
    };
    socket.on('delivery_update', onDeliveryUpdate);
    return () => {
      socket.off('delivery_update', onDeliveryUpdate);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    async function loadQuote() {
      if (!user || !departureId) {
        setQuoteFee(10000);
        return;
      }
      try {
        const res = await apiService.getDeliveryQuote(departureId);
        if (res?.success) setQuoteFee(Number(res.data?.feeAmount ?? 10000));
      } catch {
        setQuoteFee(10000);
      }
    }
    loadQuote();
  }, [departureId, user]);

  const track = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await apiService.trackDelivery(code.trim());
      if (!res.success) throw new Error(res.message || 'Delivery not found');
      setResult(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to track delivery');
    } finally {
      setLoading(false);
    }
  };

  const submitDelivery = async () => {
    if (!user) {
      setError('Please sign in to create a delivery.');
      return;
    }
    if (!departureId || !receiverName.trim() || !receiverPhone.trim()) {
      setError('Select a bus/departure and fill receiver name + phone.');
      return;
    }
    setLoading(true);
    setError('');
    setCreatedDeliveryId(null);
    setTrackingCode(null);
    try {
      const cleanedContacts = contacts
        .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }))
        .filter((c) => c.name && c.phone);

      const res = await apiService.createUserDelivery({
        departureId,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        description: description.trim() || undefined,
        contacts: cleanedContacts.length ? cleanedContacts : undefined,
      });
      if (!res.success) throw new Error(res.message || 'Failed to create delivery');
      setCreatedDeliveryId(res.data.deliveryId);
      const tc = res.data?.trackingCode || null;
      setTrackingCode(tc);
      if (tc) setCode(tc);
      setQuoteFee(Number(res.data.feeAmount ?? quoteFee ?? 10000));
      setPaymentDone(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create delivery');
    } finally {
      setLoading(false);
    }
  };

  const payNow = async () => {
    if (!createdDeliveryId) return;
    if (!paymentPhone.trim()) {
      setError('Enter a valid phone number for payment.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiService.payDelivery({
        deliveryId: createdDeliveryId,
        phoneNumber: paymentPhone.trim(),
        provider,
      });
      if (!res.success) throw new Error(res.message || 'Payment failed');
      const tc = res.trackingCode || res.data?.trackingCode || null;
      setTrackingCode(tc);
      if (tc) setCode(tc);
      setPaymentDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tighter text-black flex items-center gap-3">
          <PackageSearch className="w-8 h-8" /> Deliveries
        </h1>
        <div className="text-zinc-500 font-bold text-sm">Create parcel deliveries (signed-in users) or track with a code.</div>
      </div>

      {!user && (
        <div className="bg-white border-4 border-black rounded-[32px] p-6 space-y-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Create Delivery</div>
          <div className="text-xl font-black uppercase tracking-tighter">Sign in to book a parcel on a bus</div>
          <button
            onClick={() => router.push('/login')}
            className="px-8 py-4 rounded-2xl bg-black text-yellow-400 border-4 border-black font-black uppercase tracking-widest text-xs"
          >
            Go to Login
          </button>
        </div>
      )}

      {user && (
        <div className="bg-white border-4 border-black rounded-[32px] p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">New Delivery</div>
              <div className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <Truck className="w-5 h-5" /> Select bus + describe parcel
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {dateOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setSelectedDate(opt.key);
                  setDepartureId('');
                  setCreatedDeliveryId(null);
                  setTrackingCode(null);
                }}
                className={`px-6 py-3 rounded-2xl border-4 font-black uppercase text-xs tracking-widest ${
                  selectedDate === opt.key ? 'bg-black text-yellow-400 border-black' : 'bg-white text-black border-black hover:bg-zinc-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <select
              value={departureId}
              onChange={(e) => setDepartureId(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border-4 border-black font-bold"
            >
              <option value="">Choose a departure bus</option>
              {departures.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.departureTime} → {d.destination} · Bus {d.busTag}
                </option>
              ))}
            </select>
            {departures.length === 0 && (
              <div className="bg-zinc-50 border-2 border-black rounded-2xl p-4 font-bold text-zinc-700">
                No departures available for this date. Try another date (Today + next 2 days).
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Receiver name"
                className="px-5 py-4 rounded-2xl border-4 border-black font-bold"
              />
              <input
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                placeholder="Receiver phone"
                className="px-5 py-4 rounded-2xl border-4 border-black font-bold"
              />
            </div>

            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Parcel description (e.g., box, documents, fragile, weight)"
              className="px-5 py-4 rounded-2xl border-4 border-black font-bold"
            />

            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Additional Pickup Contacts (optional)</div>
              {contacts.map((c, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    value={c.name}
                    onChange={(e) => {
                      const next = [...contacts];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setContacts(next);
                    }}
                    placeholder="Contact name"
                    className="px-5 py-4 rounded-2xl border-4 border-black font-bold"
                  />
                  <input
                    value={c.phone}
                    onChange={(e) => {
                      const next = [...contacts];
                      next[idx] = { ...next[idx], phone: e.target.value };
                      setContacts(next);
                    }}
                    placeholder="Contact phone"
                    className="px-5 py-4 rounded-2xl border-4 border-black font-bold"
                  />
                </div>
              ))}
              <div className="flex gap-3">
                <button
                  onClick={() => setContacts((prev) => [...prev, { name: '', phone: '' }])}
                  className="px-6 py-3 rounded-2xl bg-yellow-400 text-black border-4 border-black font-black uppercase tracking-widest text-xs"
                >
                  Add Contact
                </button>
                <button
                  onClick={() => setContacts([{ name: '', phone: '' }])}
                  className="px-6 py-3 rounded-2xl bg-white text-black border-4 border-black font-black uppercase tracking-widest text-xs"
                >
                  Clear Contacts
                </button>
              </div>
            </div>

            <div className="bg-zinc-50 border-2 border-black rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Delivery Fee</div>
                <div className="font-black text-xl">UGX {Number(quoteFee).toLocaleString()}</div>
                <div className="text-xs font-bold text-zinc-500 mt-0.5">Fee is charged per parcel. Payment required after booking.</div>
              </div>
              <button
                onClick={submitDelivery}
                disabled={loading}
                className="px-8 py-4 rounded-2xl bg-black text-yellow-400 border-4 border-black font-black uppercase tracking-widest text-xs disabled:opacity-60"
              >
                {loading ? 'Creating...' : 'Create Delivery'}
              </button>
            </div>

            {createdDeliveryId && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                {/* Step indicator */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-black text-xs">✓</div>
                    <span className="text-xs font-black uppercase tracking-widest text-green-600">Delivery Created</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-black/20" />
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border-4 border-black ${paymentDone ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>
                      {paymentDone ? '✓' : '2'}
                    </div>
                    <span className={`text-xs font-black uppercase tracking-widest ${paymentDone ? 'text-green-600' : 'text-black'}`}>
                      {paymentDone ? 'Payment Confirmed' : 'Pay Now'}
                    </span>
                  </div>
                  <div className="flex-1 h-0.5 bg-black/20" />
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border-4 border-black ${paymentDone ? 'bg-green-500 text-white' : 'bg-zinc-200 text-zinc-400'}`}>
                      {paymentDone ? '✓' : '3'}
                    </div>
                    <span className={`text-xs font-black uppercase tracking-widest ${paymentDone ? 'text-green-600' : 'text-zinc-400'}`}>Print Label</span>
                  </div>
                </div>

                {/* Tracking code — always visible after creation */}
                {trackingCode && (
                  <div className="bg-zinc-50 border-4 border-black rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Tracking Code</div>
                      <div className="font-black text-xl tracking-widest">{trackingCode}</div>
                    </div>
                    {/* Print only available after payment */}
                    {paymentDone ? (
                      <button
                        onClick={() => printTrackingLabel(trackingCode)}
                        className="px-5 py-3 rounded-2xl bg-yellow-400 text-black border-4 border-black font-black uppercase tracking-widest text-xs flex items-center gap-2"
                      >
                        🖨 Print Label
                      </button>
                    ) : (
                      <div className="px-5 py-3 rounded-2xl bg-zinc-100 text-zinc-400 border-4 border-zinc-200 font-black uppercase tracking-widest text-xs cursor-not-allowed">
                        Print (pay first)
                      </div>
                    )}
                  </div>
                )}

                {/* Payment form — hidden after payment done */}
                {!paymentDone ? (
                  <div className="bg-black text-yellow-400 border-4 border-black rounded-[32px] p-6 space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-70">Step 2 — Pay Delivery Fee</div>
                    <div className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                      <Wallet className="w-5 h-5" /> UGX {Number(quoteFee).toLocaleString()} via Mobile Money
                    </div>
                    <div className="text-xs font-bold opacity-60 leading-relaxed">
                      Select your network, enter the phone number to charge, then tap Pay Now. You will receive a prompt on your phone to confirm.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value === 'Airtel' ? 'Airtel' : 'MTN')}
                        className="px-5 py-4 rounded-2xl border-4 border-yellow-400 bg-black text-yellow-400 font-black"
                      >
                        <option value="MTN">MTN Mobile Money</option>
                        <option value="Airtel">Airtel Money</option>
                      </select>
                      <input
                        value={paymentPhone}
                        onChange={(e) => setPaymentPhone(e.target.value)}
                        placeholder="e.g. 0771234567"
                        className="md:col-span-2 px-5 py-4 rounded-2xl border-4 border-yellow-400 bg-black text-yellow-400 font-black placeholder:opacity-40"
                      />
                    </div>
                    <button
                      onClick={payNow}
                      disabled={loading || !paymentPhone.trim()}
                      className="w-full px-8 py-4 rounded-2xl bg-yellow-400 text-black border-4 border-black font-black uppercase tracking-widest text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Processing...</>
                      ) : (
                        <><Wallet className="w-4 h-4" /> Pay UGX {Number(quoteFee).toLocaleString()} Now</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 border-4 border-green-500 rounded-[32px] p-6 space-y-2">
                    <div className="text-green-700 font-black uppercase tracking-widest text-sm flex items-center gap-2">
                      ✓ Payment Confirmed — UGX {Number(quoteFee).toLocaleString()}
                    </div>
                    <div className="text-green-600 font-bold text-sm">
                      Your delivery is now active. Print the label above and attach it to your parcel before dispatch.
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border-4 border-black rounded-[32px] p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter tracking code (e.g., D-123456)"
            className="flex-1 px-5 py-4 rounded-2xl border-4 border-black font-bold"
          />
          <button
            onClick={track}
            disabled={loading || code.trim().length === 0}
            className="px-8 py-4 rounded-2xl bg-black text-yellow-400 border-4 border-black font-black uppercase tracking-widest text-xs flex items-center gap-2 disabled:opacity-60"
          >
            <Search className="w-4 h-4" /> {loading ? 'Searching...' : 'Track'}
          </button>
        </div>
        {error && <div className="text-red-600 font-black">{error}</div>}
      </div>

      {user && myDeliveries.length > 0 && (
        <div className="bg-white border-4 border-black rounded-[32px] p-6 space-y-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">My Deliveries</div>
          <div className="grid grid-cols-1 gap-4">
            {myDeliveries.map((d) => (
              <div key={d.id || d.trackingCode} className="bg-zinc-50 border-2 border-black rounded-2xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="font-black uppercase tracking-tighter">
                    {d.destination || 'Delivery'} · {d.travelDate || '—'}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border-2 ${
                      d.paymentStatus === 'Completed' ? 'bg-green-100 text-green-700 border-green-400' : 'bg-amber-100 text-amber-700 border-amber-400'
                    }`}>
                      {d.paymentStatus === 'Completed' ? '✓ Paid' : 'Pending Payment'}
                    </span>
                    {d.paymentStatus === 'Completed' && d.trackingCode && (
                      <button
                        onClick={() => printTrackingLabel(d.trackingCode)}
                        className="px-4 py-2 rounded-xl bg-yellow-400 text-black border-2 border-black font-black uppercase tracking-widest text-xs"
                      >
                        🖨 Print
                      </button>
                    )}
                  </div>
                </div>
                <div className="font-black text-sm mt-1 text-zinc-500">{d.trackingCode}</div>
                {d.description && <div className="font-bold text-zinc-700 text-sm mt-1">{d.description}</div>}
                {d.status && (
                  <div className="text-xs font-bold text-zinc-500 mt-1 uppercase">Status: {d.status}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white border-4 border-black rounded-[32px] p-8 space-y-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tracking</div>
          <div className="text-2xl font-black uppercase tracking-tighter">{result.trackingCode}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-50 border-2 border-black rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Receiver</div>
              <div className="font-black">{result.receiverName}</div>
              <div className="font-bold text-zinc-600 text-sm">{result.receiverPhone}</div>
            </div>
            <div className="bg-zinc-50 border-2 border-black rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</div>
              <div className="font-black">{result.status}</div>
              {result.arrivedAt ? (
                <div className="font-bold text-zinc-600 text-sm">
                  Your parcel has reached the pickup point: {new Date(result.arrivedAt).toLocaleString()}
                </div>
              ) : null}
              {result.travelDate && <div className="font-bold text-zinc-600 text-sm">Date: {result.travelDate}</div>}
            </div>
          </div>
          {result.destination && (
            <div className="bg-zinc-50 border-2 border-black rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Destination</div>
              <div className="font-black">{result.destination}</div>
            </div>
          )}
          {result.trip?.expectedArrivalAt && (
            <div className="bg-zinc-50 border-2 border-black rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Expected Arrival</div>
              <div className="font-black">{new Date(result.trip.expectedArrivalAt).toLocaleString()}</div>
            </div>
          )}
          {result.description && (
            <div className="bg-zinc-50 border-2 border-black rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</div>
              <div className="font-bold text-zinc-700">{result.description}</div>
            </div>
          )}
          {result.contacts?.length ? (
            <div className="bg-zinc-50 border-2 border-black rounded-2xl p-4 space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pickup Contacts</div>
              {result.contacts.map((c, idx) => (
                <div key={idx} className="font-bold text-zinc-700 text-sm">
                  {c.name} · {c.phone}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
