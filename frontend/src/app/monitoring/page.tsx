'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Wifi, Zap, Radio, RefreshCw, MapPin } from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '@/services/api';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { 
  LineChart, Line, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip as LeafletTooltip, ZoomControl } from 'react-leaflet';
import L from 'leaflet';

// ─── Hub + Bus Data ────────────────────────────────────────────────
interface Bus {
  id: string;
  tag: string;
  hubId: string;
  destination: string;
  speed: number;
  battery: number;
  status: 'Active' | 'Charging' | 'En Route' | 'Arrived' | 'Critical' | 'Delayed';

  gpsLat: number;
  gpsLng: number;
  x: number; // map position %
  y: number;
}

interface Alert {
  id: string;
  severity: 'warning' | 'critical' | 'ok' | 'info';
  message: string;
  createdAt: string;
}

interface TelemetryPoint {
  busId: string;
  gpsLat: number;
  gpsLng: number;
  battery: number;
  speed: number;
  [key: string]: unknown;
}


const HUBS = [
  { id: 'hub_east', name: 'Namanve Hub', code: 'NMV', x: 62, y: 44, color: '#facc15', lat: 0.3521, lng: 32.649 },
  { id: 'hub_west', name: 'Busega Hub', code: 'BSG', x: 48, y: 50, color: '#38bdf8', lat: 0.3127, lng: 32.528 },
  { id: 'hub_north', name: 'Kawempe Hub', code: 'KWP', x: 50, y: 41, color: '#fb923c', lat: 0.366, lng: 32.553 },
];

const DESTINATION_ALIASES: Record<string, string> = {
  'fortportal': 'Fort Portal',
  'ft portal': 'Fort Portal',
  'kampala city': 'Kampala',
};

const mapCoords = (lat: number, lng: number) => {
  return {
    x: 50 + (lng - 32.5825) * 50,
    y: 47 - (lat - 0.3476) * 50
  };
};

const DESTINATION_COORDS: Record<string, { lat: number; lng: number }> = {
  Kampala: { lat: 0.3476, lng: 32.5825 },
  Entebbe: { lat: 0.0511, lng: 32.4637 },
  Jinja: { lat: 0.4244, lng: 33.2042 },
  Mbale: { lat: 1.0827, lng: 34.175 },
  Gulu: { lat: 2.7667, lng: 32.305 },
  Arua: { lat: 3.0191, lng: 30.9237 },
  Hoima: { lat: 1.4356, lng: 31.3436 },
  Masaka: { lat: -0.3127, lng: 31.7138 },
  Mbarara: { lat: -0.6072, lng: 30.6545 },
  Kabale: { lat: -1.2486, lng: 29.9897 },
  'Fort Portal': { lat: 0.671, lng: 30.275 },
};

const TILE_URL =
  process.env.NEXT_PUBLIC_TILE_URL ||
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function toBusTagColor(tag: string) {
  const colors = ['#facc15', '#38bdf8', '#fb923c', '#a78bfa', '#22c55e', '#f472b6'];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function buildBusIcon(color: string, selected: boolean) {
  const size = selected ? 44 : 36;
  const border = selected ? '#000000' : '#111111';
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${border}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6" />
      <path d="M16 6v6" />
      <path d="M2 12h20" />
      <path d="M18 18h2" />
      <path d="M4 18h2" />
      <path d="M19 17v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2" />
      <path d="M21 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />
    </svg>`
  );

  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:14px;background:${color};border:3px solid ${border};box-shadow:6px 6px 0px 0px rgba(0,0,0,1);display:flex;align-items:center;justify-content:center;">
      <img src="data:image/svg+xml,${svg}" style="width:${Math.round(size * 0.65)}px;height:${Math.round(size * 0.65)}px;" />
    </div>`,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
    popupAnchor: [0, -Math.round(size / 2)],
  });
}

// ─── Component ────────────────────────────────────────────────────
export default function Monitoring() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [animatedPositions, setAnimatedPositions] = useState<Record<string, { gpsLat: number; gpsLng: number }>>({});
  const [selected, setSelected] = useState<Bus | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [telemetryData, setTelemetryData] = useState<TelemetryPoint[]>([]);
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [resolvedDestinationCoord, setResolvedDestinationCoord] = useState<{ lat: number; lng: number } | null>(null);
  const geocodeCacheRef = useRef<Record<string, { lat: number; lng: number } | null>>({});

  const { isAdmin, isLoading } = useAuth();

  const socket = useSocket();
  const selectedBusId = selected?.id;

  const destinationCoord = useMemo(() => {
    if (!selected?.destination) return null;
    const normalized = selected.destination.trim().toLowerCase();
    const aliased = DESTINATION_ALIASES[normalized];
    if (aliased && DESTINATION_COORDS[aliased]) return DESTINATION_COORDS[aliased];
    return DESTINATION_COORDS[selected.destination] || resolvedDestinationCoord;
  }, [selected?.destination, resolvedDestinationCoord]);

  useEffect(() => {
    let cancelled = false;

    async function resolveDestination() {
      if (!selected?.destination) {
        setResolvedDestinationCoord(null);
        return;
      }

      const raw = selected.destination.trim();
      const normalized = raw.toLowerCase();
      const alias = DESTINATION_ALIASES[normalized];
      const known = DESTINATION_COORDS[raw] || (alias ? DESTINATION_COORDS[alias] : null);
      if (known) {
        setResolvedDestinationCoord(known);
        return;
      }

      if (Object.prototype.hasOwnProperty.call(geocodeCacheRef.current, normalized)) {
        setResolvedDestinationCoord(geocodeCacheRef.current[normalized]);
        return;
      }

      try {
        const query = encodeURIComponent(`${raw}, Uganda`);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ug&q=${query}`);
        const data = await response.json();
        const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
        const resolved = first
          ? { lat: Number(first.lat), lng: Number(first.lon) }
          : null;
        geocodeCacheRef.current[normalized] = resolved;
        if (!cancelled) {
          setResolvedDestinationCoord(resolved);
        }
      } catch {
        geocodeCacheRef.current[normalized] = null;
        if (!cancelled) {
          setResolvedDestinationCoord(null);
        }
      }
    }

    resolveDestination();
    return () => {
      cancelled = true;
    };
  }, [selected?.destination]);

  useEffect(() => {
    async function loadRoute() {
      if (!selected || !destinationCoord) {
        setRoutePath([]);
        setEtaMinutes(null);
        return;
      }
      if (!Number.isFinite(selected.gpsLat) || !Number.isFinite(selected.gpsLng)) {
        setRoutePath([]);
        setEtaMinutes(null);
        return;
      }

      try {
        const res = await apiService.getRouting(selected.gpsLat, selected.gpsLng, destinationCoord.lat, destinationCoord.lng);
        if (res.success && Array.isArray(res.data)) {
          const path = res.data as Array<[number, number]>;
          setRoutePath(path);

          const distKm = path.length >= 2
            ? path.reduce((acc, cur, idx) => {
                if (idx === 0) return 0;
                const prev = path[idx - 1];
                return acc + haversineKm({ lat: prev[0], lng: prev[1] }, { lat: cur[0], lng: cur[1] });
              }, 0)
            : haversineKm({ lat: selected.gpsLat, lng: selected.gpsLng }, destinationCoord);

          const speedKmh = Number.isFinite(selected.speed) && selected.speed > 0 ? selected.speed : 50;
          setEtaMinutes(Math.max(1, Math.round((distKm / Math.max(10, speedKmh)) * 60)));
          return;
        }
      } catch {
      }

      const distKm = haversineKm({ lat: selected.gpsLat, lng: selected.gpsLng }, destinationCoord);
      const speedKmh = Number.isFinite(selected.speed) && selected.speed > 0 ? selected.speed : 50;
      setEtaMinutes(Math.max(1, Math.round((distKm / Math.max(10, speedKmh)) * 60)));
      setRoutePath([]);
    }

    loadRoute();
  }, [selected, destinationCoord]);

  const fetchTelemetry = async (busId: string) => {
    try {
      const res = await apiService.getTelemetry(busId);
      if (res.success) {
        setTelemetryData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry', err);
    }
  };

  useEffect(() => {
    if (selectedBusId) {
      fetchTelemetry(selectedBusId);
    } else {
      setTelemetryData([]);
    }
  }, [selectedBusId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('fleet_update', (data: Bus[]) => {
      const mappedBuses = data.map((b: Bus) => {
        const { x, y } = mapCoords(b.gpsLat, b.gpsLng);
        return { ...b, x, y };
      });
      setBuses(mappedBuses);
      setLoading(false);
    });

    socket.on('telemetry_update', (data: TelemetryPoint) => {
      // Update specific bus in the list if it's NOT the global update
      setBuses(prev => prev.map(b => b.id === data.busId ? { ...b, ...data, ...mapCoords(data.gpsLat, data.gpsLng) } : b));
      
      // Update chart if this is the selected bus
      if (selectedBusId && data.busId === selectedBusId) {
        setTelemetryData(prev => {
          const newData = [...prev, data];
          return newData.slice(-60); // Keep last 60 points
        });
      }
    });

    return () => {
      socket.off('fleet_update');
      socket.off('telemetry_update');
      socket.off('alerts_update');
    };
  }, [socket, selectedBusId]);

  useEffect(() => {
    if (!socket) return;
    socket.on('alerts_update', (data: Alert[]) => {
      if (Array.isArray(data)) setAlerts(data.slice(0, 10));
    });
    return () => { socket.off('alerts_update'); };
  }, [socket]);

  useEffect(() => {
    if (!selected?.id) return;
    const liveSelected = buses.find((b) => b.id === selected.id);
    if (!liveSelected) return;
    if (
      liveSelected.gpsLat !== selected.gpsLat ||
      liveSelected.gpsLng !== selected.gpsLng ||
      liveSelected.speed !== selected.speed ||
      liveSelected.battery !== selected.battery ||
      liveSelected.status !== selected.status ||
      liveSelected.destination !== selected.destination
    ) {
      setSelected(liveSelected);
    }
  }, [buses, selected]);

  useEffect(() => {
    setAnimatedPositions((prev) => {
      const next: Record<string, { gpsLat: number; gpsLng: number }> = {};
      for (const bus of buses) {
        if (!Number.isFinite(bus.gpsLat) || !Number.isFinite(bus.gpsLng)) continue;
        next[bus.id] = prev[bus.id] || { gpsLat: bus.gpsLat, gpsLng: bus.gpsLng };
      }
      return next;
    });
  }, [buses]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedPositions((prev) => {
        if (buses.length === 0) return prev;
        let changed = false;
        const next = { ...prev };

        for (const bus of buses) {
          if (!Number.isFinite(bus.gpsLat) || !Number.isFinite(bus.gpsLng)) continue;
          const current = next[bus.id] || { gpsLat: bus.gpsLat, gpsLng: bus.gpsLng };
          const dLat = bus.gpsLat - current.gpsLat;
          const dLng = bus.gpsLng - current.gpsLng;

          if (Math.abs(dLat) < 0.00001 && Math.abs(dLng) < 0.00001) {
            next[bus.id] = { gpsLat: bus.gpsLat, gpsLng: bus.gpsLng };
            continue;
          }

          const smoothing = 0.22;
          next[bus.id] = {
            gpsLat: current.gpsLat + dLat * smoothing,
            gpsLng: current.gpsLng + dLng * smoothing,
          };
          changed = true;
        }

        return changed ? next : prev;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [buses]);

  const displayBuses = useMemo(
    () =>
      buses.map((bus) => {
        const pos = animatedPositions[bus.id];
        if (!pos) return bus;
        return {
          ...bus,
          gpsLat: pos.gpsLat,
          gpsLng: pos.gpsLng,
        };
      }),
    [buses, animatedPositions]
  );


  const fetchFleet = useCallback(async () => {
    try {
      const res = isAdmin ? await apiService.getFleet() : await apiService.getFleetLive();
      if (res.success) {
        const fleetData = res.data as Bus[];
        const mappedBuses = fleetData.map((b: Bus) => {

          const { x, y } = mapCoords(b.gpsLat, b.gpsLng);
          return { ...b, x, y };
        });
        setBuses(mappedBuses);
      }
    } catch (err) {
      console.error('Failed to fetch fleet', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiService.getAlerts();
      if (res.success) {
        setAlerts(res.data.slice(0, 10)); // Top 10 latest
      }
    } catch {
      console.error('Alert fetch failed');
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    fetchFleet();
    if (!isAdmin) return;
    fetchAlerts();
    const interval = setInterval(() => {
      fetchAlerts();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchAlerts, fetchFleet, isAdmin, isLoading]);

  const statusColor = (s: string) => {
    if (s === 'Active' || s === 'En Route') return 'bg-green-500';
    if (s === 'Charging') return 'bg-amber-500';
    if (s === 'Critical') return 'bg-red-600 animate-pulse';
    if (s === 'Delayed') return 'bg-orange-500';
    return 'bg-blue-400';
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-10 relative">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Activity className="w-10 h-10 text-yellow-400 fill-black animate-pulse" />
            <h2 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none">Digital Twin Telemetry</h2>
          </div>
          <p className="text-zinc-500 font-bold ml-1">Virtual representation of the regional transit nexus · Operational Oversight.</p>
        </div>

        <div className="flex items-center gap-6">
           <div className="hidden lg:grid grid-cols-3 gap-8 px-8 border-r border-zinc-200">
              <div>
                <div className="text-[10px] font-black uppercase text-zinc-400">Net Latency</div>
                <div className="text-sm font-black italic">12ms <span className="text-green-500 text-[8px] uppercase">Optimal</span></div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-zinc-400">Total Units</div>
                <div className="text-sm font-black italic text-black">{buses.length} OF 12</div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-zinc-400">V-Throughput</div>
                <div className="text-sm font-black italic text-yellow-500">92.4%</div>
              </div>
           </div>

           <div className="flex items-center gap-4 bg-black p-4 rounded-3xl border-4 border-yellow-400 shadow-xl">
              <div className="flex -space-x-3">
                  {HUBS.map(h => (
                    <div key={h.id} className="w-10 h-10 rounded-full border-4 border-black flex items-center justify-center font-black text-[10px]" style={{ background: h.color }}>
                      {h.code}
                    </div>
                  ))}
              </div>
              <div className="h-10 w-px bg-zinc-800" />
              <div className="text-white">
                  <div className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Pulse Status</div>
                  <div className="text-sm font-black uppercase italic">Twin Synchronized</div>
              </div>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Unit List (Col 3) */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Digital Assets</h3>
              <span className="bg-black text-yellow-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">Online</span>
           </div>

           <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                <div className="p-10 text-center font-black uppercase tracking-widest text-zinc-300">Synchronizing...</div>
              ) : buses.map(bus => (
                <div 
                  key={bus.id}
                  onClick={() => {
                    if (selected?.id === bus.id) {
                      setSelected(null);
                      setRoutePath([]);
                      setEtaMinutes(null);
                      return;
                    }
                    setSelected(bus);
                  }}
                  className={`p-4 rounded-[24px] border-4 transition-all cursor-pointer ${selected?.id === bus.id ? 'bg-black border-black text-yellow-400 scale-[1.02] shadow-2xl' : 'bg-white border-zinc-100 hover:border-black'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                     <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${selected?.id === bus.id ? 'bg-yellow-400 text-black' : 'bg-zinc-100'}`}>
                        {bus.tag}
                     </span>
                     <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusColor(bus.status)}`} />
                        <span className="text-[9px] font-black uppercase leading-none">{bus.status}</span>
                     </div>
                  </div>
                  <div className="flex items-center justify-between">
                     <div>
                        <div className={`text-[9px] font-black uppercase ${selected?.id === bus.id ? 'text-white/40' : 'text-zinc-400'}`}>Target</div>
                        <div className="font-black text-sm">{bus.destination}</div>
                     </div>
                     <div className="text-right">
                        <div className={`text-[9px] font-black uppercase ${selected?.id === bus.id ? 'text-white/40' : 'text-zinc-400'}`}>Velocity</div>
                        <div className="font-black text-sm italic">{bus.speed.toFixed(0)} KM/H</div>
                     </div>
                  </div>
                </div>
              ))}
           </div>
        </div>

        {/* Map Visualization (Col 6) */}
        <div className="lg:col-span-6 relative">
           <div className="bg-zinc-50 border-8 border-black rounded-[48px] h-[800px] overflow-hidden relative shadow-2xl">
              <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="absolute top-6 left-6 bg-white border-4 border-black rounded-3xl p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-[320px]">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Uganda Live Map</div>
                  <div className="text-xl font-black uppercase tracking-tighter">Bus Tracking</div>
                  <div className="text-xs font-bold text-zinc-600">Hover a bus to see its tag · Click for route + ETA</div>
                  {selected && (
                    <div className="mt-3 border-t-2 border-black pt-3 space-y-1">
                      <div className="text-sm font-black uppercase tracking-tighter">{selected.tag}</div>
                      <div className="text-xs font-bold text-zinc-600">To {selected.destination}</div>
                      <div className="text-xs font-black">
                        ETA: {etaMinutes !== null ? `${etaMinutes} min` : '—'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <MapContainer
                center={[0.3476, 32.5825]}
                zoom={7}
                minZoom={6}
                scrollWheelZoom
                zoomControl={false}
                className="h-full w-full z-0"
              >
                <ZoomControl position="bottomright" />
                <TileLayer
                  attribution={TILE_ATTRIBUTION}
                  url={TILE_URL}
                  updateWhenIdle
                  keepBuffer={2}
                />

                {routePath.length > 1 && (
                  <Polyline
                    positions={routePath}
                    pathOptions={{ color: '#000000', weight: 5, opacity: 0.85 }}
                  />
                )}

                {HUBS.map((hub) => (
                  <Marker
                    key={hub.id}
                    position={[hub.lat, hub.lng]}
                    icon={L.divIcon({
                      className: '',
                      html: `<div style="width:18px;height:18px;border-radius:999px;background:${hub.color};border:3px solid #000;box-shadow:4px 4px 0px 0px rgba(0,0,0,1);"></div>`,
                      iconSize: [18, 18],
                      iconAnchor: [9, 9],
                    })}
                  >
                    <LeafletTooltip direction="top" offset={[0, -10]} opacity={1}>
                      <div className="font-black uppercase text-[10px] tracking-widest">{hub.name}</div>
                    </LeafletTooltip>
                  </Marker>
                ))}

                {displayBuses
                  .filter((b) => Number.isFinite(b.gpsLat) && Number.isFinite(b.gpsLng))
                  .map((bus) => {
                    const color = toBusTagColor(bus.tag);
                    const isSelected = selected?.id === bus.id;
                    return (
                      <Marker
                        key={bus.id}
                        position={[bus.gpsLat, bus.gpsLng]}
                        icon={buildBusIcon(color, isSelected)}
                        eventHandlers={{
                          click: () => {
                            if (selected?.id === bus.id) {
                              setSelected(null);
                              setRoutePath([]);
                              setEtaMinutes(null);
                              return;
                            }
                            setSelected(bus);
                          },
                        }}
                      >
                        <LeafletTooltip direction="top" offset={[0, -18]} opacity={1} sticky>
                          <div className="font-black uppercase text-[10px] tracking-widest">{bus.tag}</div>
                        </LeafletTooltip>
                      </Marker>
                    );
                  })}
              </MapContainer>
           </div>
        </div>

        {/* Live Event Feed & Telemetry Intelligence (Col 3) */}
        <div className="lg:col-span-3 space-y-6">
           <AnimatePresence mode="wait">
             {selected ? (
               <motion.div 
                 key="telemetry"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 20 }}
                 className="space-y-6"
               >
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-yellow-500">Telemetry Intelligence</h3>
                    <button 
                      onClick={() => setSelected(null)}
                      className="text-[9px] font-black uppercase text-zinc-400 hover:text-black border-b border-zinc-200"
                    >
                      Clear Focus
                    </button>
                 </div>

                 <div className="bg-black rounded-[32px] p-6 border-4 border-yellow-400 shadow-2xl space-y-8">
                    <div className="flex items-center justify-between">
                       <div>
                          <div className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Active Unit</div>
                          <div className="text-2xl font-black text-white italic tracking-tighter uppercase">{selected.tag}</div>
                       </div>
                       <div className="text-right">
                          <div className={`w-3 h-3 rounded-full ml-auto mb-2 ${statusColor(selected.status)} shadow-[0_0_15px_current]`} />
                          <div className="text-[9px] font-black uppercase text-white leading-none">{selected.status}</div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="text-[9px] font-black uppercase text-white/20 mb-1">Core Battery</div>
                          <div className="text-xl font-black text-yellow-400">{selected.battery.toFixed(0)}%</div>
                       </div>
                       <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                          <div className="text-[9px] font-black uppercase text-white/20 mb-1">Velocity</div>
                          <div className="text-xl font-black text-white">{selected.speed.toFixed(0)} <span className="text-[10px] opacity-40">KM/H</span></div>
                       </div>
                    </div>

                    {/* Charts */}
                    <div className="space-y-6">
                       <div className="space-y-3">
                          <div className="text-[9px] font-black uppercase text-white/40 tracking-widest flex justify-between">
                             <span>Voltage Stability</span>
                             <span className="text-yellow-400">Live Feed</span>
                          </div>
                          <div className="h-32 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={telemetryData}>
                                   <defs>
                                      <linearGradient id="colorBatt" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#facc15" stopOpacity={0.3}/>
                                         <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                                      </linearGradient>
                                   </defs>
                                   <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                   <RechartsTooltip 
                                      contentStyle={{ background: '#000', border: '1px solid #333', borderRadius: '12px', fontSize: '10px' }}
                                      itemStyle={{ color: '#facc15' }}
                                   />
                                   <Area type="monotone" dataKey="battery" stroke="#facc15" fillOpacity={1} fill="url(#colorBatt)" strokeWidth={3} isAnimationActive={false} />
                                </AreaChart>
                             </ResponsiveContainer>
                          </div>
                       </div>

                       <div className="space-y-3">
                          <div className="text-[9px] font-black uppercase text-white/40 tracking-widest flex justify-between">
                             <span>Kinetic Output</span>
                             <span className="text-blue-400">Telemetry Delta</span>
                          </div>
                          <div className="h-32 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={telemetryData}>
                                   <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                   <RechartsTooltip 
                                      contentStyle={{ background: '#000', border: '1px solid #333', borderRadius: '12px', fontSize: '10px' }}
                                   />
                                   <Line type="stepAfter" dataKey="speed" stroke="#38bdf8" strokeWidth={3} dot={false} isAnimationActive={false} />
                                </LineChart>
                             </ResponsiveContainer>
                          </div>
                       </div>
                    </div>
                    
                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] text-center border-t border-white/5 pt-4">
                       Synchronized with Transit Nexus Node
                    </p>

                    {/* Remote Operations */}
                    {isAdmin && (
                      <div className="pt-2 border-t border-white/5 space-y-4">
                        <h4 className="text-[9px] font-black uppercase text-yellow-500 tracking-widest">Remote Operations</h4>
                        <div className="grid grid-cols-2 gap-3">
                           <button 
                             onClick={async () => {
                               const res = await apiService.maintenanceAction(selected.id, 'charge');
                               if (res.success) fetchFleet();
                             }}
                             className="bg-zinc-900 hover:bg-zinc-800 text-[9px] font-black uppercase py-3 rounded-xl text-white border border-white/5 transition-all flex items-center justify-center gap-2"
                           >
                              <Zap className="w-3 h-3 text-yellow-400" /> Init Charge
                           </button>
                           <button 
                              onClick={async () => {
                                 const res = await apiService.maintenanceAction(selected.id, 'repair');
                                 if (res.success) fetchFleet();
                             }}
                             className="bg-zinc-900 hover:bg-zinc-800 text-[9px] font-black uppercase py-3 rounded-xl text-white border border-white/5 transition-all flex items-center justify-center gap-2"
                           >
                              <RefreshCw className="w-3 h-3 text-blue-400" /> Total Reset
                           </button>
                           <button 
                             onClick={async () => {
                                 const res = await apiService.maintenanceAction(selected.id, 'emergency_stop');
                                 if (res.success) fetchFleet();
                             }}
                             className="bg-red-500/10 hover:bg-red-500/20 text-[9px] font-black uppercase py-3 rounded-xl text-red-500 border border-red-500/20 col-span-2 transition-all"
                           >
                              Emergency Override
                           </button>
                        </div>
                      </div>
                    )}
                 </div>
               </motion.div>
             ) : (
               <motion.div 
                 key="alerts"
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="space-y-6"
               >
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Digital Twin Events</h3>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                       <span className="text-[9px] font-black uppercase text-green-600">Syncing</span>
                    </div>
                 </div>

                 <div className="space-y-4 max-h-[700px] overflow-y-auto custom-scrollbar">
                    {alerts.length === 0 ? (
                      <div className="p-20 text-center text-[10px] font-black uppercase text-zinc-300">Awaiting Signal...</div>
                    ) : alerts.map((a) => (
                      <motion.div 
                         key={a.id}
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         className={`p-5 rounded-3xl border-4 ${
                           a.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                           a.severity === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-600' :
                           a.severity === 'ok' ? 'bg-green-500/10 border-green-500/20 text-green-600' :
                           'bg-black border-black text-white'
                         }`}
                      >
                         <div className="flex items-center gap-3 mb-2 flex-wrap">
                            {a.severity === 'critical' ? <AlertCircle className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Event LOG_{String(a.id).slice(0,4)}</span>
                            {/Simulated|Scenario|Advisory|Emergency|Restriction|Congestion|Offline|Reset/i.test(a.message) && (
                              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-400 text-black border border-black">
                                Scenario
                              </span>
                            )}
                         </div>
                         <p className="font-black text-xs leading-relaxed uppercase">{a.message}</p>
                         <p className="text-[9px] font-bold opacity-40 mt-1">{new Date(a.createdAt).toLocaleTimeString()}</p>
                      </motion.div>
                    ))}
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Extra Icons
function Settings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle">
      <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
    </svg>
  );
}
