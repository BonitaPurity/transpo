'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Zap, AlertCircle, Bus as BusIcon, User as UserIcon } from 'lucide-react';
import { renderToString } from 'react-dom/server';

interface MapComponentProps {
  buses: Array<{ id: string; gpsLat: number; gpsLng: number; status: string; tag: string; destination: string; battery: number; speed: number }>;
  hubs: Array<{ id: string; name: string; color: string; x: number; y: number; lat: number; lng: number; code: string }>;
  selected: { id: string } | null;
  onSelect: (bus: { id: string; gpsLat: number; gpsLng: number; status: string; tag: string; destination: string; battery: number; speed: number }) => void;
  userLocation: { lat: number; lng: number } | null;
  userRoute: Array<{ lat: number; lng: number }>;
}

export default function MapComponent({ buses, hubs, selected, onSelect, userLocation, userRoute }: MapComponentProps) {
  // Center map on user if available, else Kampala area
  const center: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : [0.3476, 32.5825];
  const bounds: [number, number][] = [
    [-1.5, 29.5], // South West
    [4.5, 35.5]   // North East
  ];

  const createHubIcon = (color: string, text: string) => {
    const htmlString = `
      <div style="background: black; border: 4px solid ${color}; width: 40px; height: 40px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: ${color}; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);">
         <div style="font-size: 10px; font-weight: 900;">${text}</div>
      </div>
    `;
    return L.divIcon({
      html: htmlString,
      className: 'custom-hub-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  const createBusIcon = (bus: { id: string; gpsLat: number; gpsLng: number; status: string }) => {
    const isSelected = selected?.id === bus.id;
    const isCritical = bus.status === 'Critical';
    const isCharging = bus.status === 'Charging';
    
    let borderColor = isSelected ? 'white' : 'black';
    const bgColor = isSelected ? 'black' : 'white';
    if (isCritical) borderColor = 'red';

    const IconWrapper = () => (
      <div className={`p-1.5 rounded-xl border-2 shadow-lg transition-all flex items-center justify-center`} 
           style={{ 
             background: bgColor, 
             borderColor: borderColor, 
             width: '32px', height: '32px',
             transform: isSelected ? 'scale(1.2)' : 'none',
             animation: isCritical ? 'pulse 2s infinite' : 'none'
           }}>
        {isCharging ? (
          <Zap size={16} color={isSelected ? '#facc15' : '#f59e0b'} />
        ) : isCritical ? (
          <AlertCircle size={16} color="#ef4444" />
        ) : (
          <BusIcon size={16} color={isSelected ? '#facc15' : 'black'} />
        )}
      </div>
    );

    return L.divIcon({
      html: renderToString(<IconWrapper />),
      className: 'custom-bus-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  return (
    <div className="w-full h-full bg-zinc-900 absolute inset-0">
      <MapContainer 
        center={center} 
        zoom={7} 
        scrollWheelZoom={false}
        className="w-full h-full"
        bounds={bounds}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* User Location Marker */}
        {userLocation && (
          <>
            <Circle 
              center={[userLocation.lat, userLocation.lng]} 
              radius={300} 
              pathOptions={{ fillColor: '#38bdf8', fillOpacity: 0.2, color: 'transparent' }} 
            />
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={L.divIcon({
                html: renderToString(
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-10 h-10 bg-blue-400 rounded-full animate-ping opacity-25" />
                    <div className="relative w-8 h-8 bg-black border-4 border-blue-400 rounded-2xl flex items-center justify-center shadow-2xl">
                       <UserIcon size={16} className="text-blue-400" />
                    </div>
                  </div>
                ),
                className: 'custom-user-icon',
                iconSize: [40, 40],
                iconAnchor: [20, 20],
              })}
            >
              <Popup className="custom-popup">
                <div className="font-black text-[10px] uppercase text-center tracking-widest text-blue-500">Your Actual Position</div>
              </Popup>
            </Marker>
          </>
        )}

        {/* User Routing Path */}
        {userRoute && userRoute.length > 0 && (
          <Polyline 
            positions={userRoute.map(p => [p.lat, p.lng])}
            pathOptions={{ 
              color: '#38bdf8', 
              weight: 6, 
              opacity: 0.6, 
              dashArray: '1, 12',
              lineCap: 'round',
              className: 'animate-dash' 
            }}
          />
        )}

        {hubs.map((hub) => (
          <Marker 
            key={hub.id} 
            position={[hub.lat, hub.lng]} 
            icon={createHubIcon(hub.color, hub.code)}
          >
            <Popup className="custom-popup">
              <div className="font-black text-xs uppercase">{hub.name}</div>
            </Popup>
          </Marker>
        ))}

        {buses.map((bus) => (
          <Marker
            key={bus.id}
            position={[bus.gpsLat, bus.gpsLng]}
            icon={createBusIcon(bus)}
            eventHandlers={{
              click: () => onSelect(bus),
            }}
          >
            {/* If it's selected, we could show a popup, though the dashboard already handles info panel */}
            <Popup className="custom-popup">
              <div className="bg-black text-yellow-400 p-2 rounded-xl text-center min-w-[120px]">
                <div className="text-[10px] font-black uppercase mb-1">{bus.tag}</div>
                <div className="text-xs font-bold text-white mb-2">To {bus.destination}</div>
                <div className="flex justify-between text-[10px]">
                  <span>{bus.battery.toFixed(0)}%</span>
                  <span>{bus.speed.toFixed(0)} KM/H</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <style>{`
        .custom-bus-icon, .custom-hub-icon, .custom-user-icon {
          background: transparent;
          border: none;
        }
        .animate-dash {
          stroke-dashoffset: 0;
          animation: dash 20s linear infinite;
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -1000;
          }
        }
        .leaflet-popup-content-wrapper {
          background: transparent;
          box-shadow: none;
        }
        .leaflet-popup-tip {
          display: none;
        }
      `}</style>
    </div>
  );
}
