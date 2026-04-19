'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket] = useState<Socket | null>(() => {
    const enabled = process.env.NEXT_PUBLIC_ENABLE_SOCKET !== 'false';
    if (!enabled) return null;
    const debug = process.env.NEXT_PUBLIC_DEBUG === 'true';
    const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL || '';

    const inferredFromApi = (() => {
      try {
        if (!envApiUrl) return '';
        if (envApiUrl.startsWith('/')) return '';
        const u = new URL(envApiUrl);
        return u.origin;
      } catch {
        return '';
      }
    })();

    const inferredFromWindow = typeof window !== 'undefined' ? window.location.origin : '';
    const base = (envSocketUrl || inferredFromApi || inferredFromWindow).trim();
    if (!base) return null;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const normalized = isHttps ? base.replace(/^http:\/\//i, 'https://') : base;
    if (debug) {
      console.log('Connecting to Real-Time Nexus at:', normalized);
    }
    return io(normalized, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 50,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
  });

  useEffect(() => {
    if (!socket) return;

    const debug = process.env.NEXT_PUBLIC_DEBUG === 'true';
    socket.on('connect', () => {
      if (debug) console.log('Socket Connected');
    });
    socket.on('connect_error', (err) => console.error('Socket Connection Error:', err));

    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
