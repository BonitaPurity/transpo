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
    const localBackendPort = String(process.env.NEXT_PUBLIC_BACKEND_PORT || '5000');

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

    const inferredFromWindow = (() => {
      if (typeof window === 'undefined') return '';
      const { protocol, hostname, port, origin } = window.location;
      const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
      const isFrontendDevPort = port === '3000' || port === '3001' || port === '5173';
      if (isLocalHost && isFrontendDevPort) {
        return `${protocol}//${hostname}:${localBackendPort}`;
      }
      return origin;
    })();

    const base = (envSocketUrl || inferredFromApi || inferredFromWindow).trim();
    if (!base) return null;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const normalized = isHttps ? base.replace(/^http:\/\//i, 'https://') : base;
    if (debug) {
      console.log('Connecting to Real-Time Nexus at:', normalized);
    }
    return io(normalized, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      timeout: 8000,
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
