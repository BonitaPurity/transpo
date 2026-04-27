'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '@/services/api';

export type UserRole = 'user' | 'admin' | 'logistics_operator';

export interface User {
  id?: number;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  token?: string;
  refreshToken?: string;
  tokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  adminLogin: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initialized = React.useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    
    const initAuth = async () => {
      const restored = localStorage.getItem('transpo_user');
      // Delay state update slightly to ensure it's not synchronous in the effect
      await new Promise(resolve => setTimeout(resolve, 0));
      
      if (restored) {
        try {
          const parsed = JSON.parse(restored);
          if (parsed?.token) {
            const me = await apiService.getMe();
            if (me?.success && me?.data) {
              const hydratedUser: User = {
                ...parsed,
                ...me.data,
                token: parsed.token,
                refreshToken: parsed.refreshToken,
                tokenExpiresAt: parsed.tokenExpiresAt || null,
                refreshTokenExpiresAt: parsed.refreshTokenExpiresAt || null,
              };
              setUser(hydratedUser);
              localStorage.setItem('transpo_user', JSON.stringify(hydratedUser));
            } else {
              localStorage.removeItem('transpo_user');
            }
          } else {
            localStorage.removeItem('transpo_user');
          }
        } catch {
          localStorage.removeItem('transpo_user');
        }
      }
      setIsLoading(false);
      initialized.current = true;
    };
    initAuth();
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      try {
        localStorage.removeItem('transpo_user');
      } catch {}
    };
    window.addEventListener('transpo_unauthorized', onUnauthorized);
    return () => window.removeEventListener('transpo_unauthorized', onUnauthorized);
  }, []);







  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiService.login({ email, password });
      if (!response?.success) return false;

      const newUser: User = {
        id: response.data?.user?.id || response.data?.id,
        name: response.data?.user?.name || response.data?.name,
        phone: response.data?.user?.phone || response.data?.phone || 'N/A',
        email: response.data?.user?.email || response.data?.email,
        role: (response.data?.user?.role || response.data?.role) as UserRole,
        token: response.data?.token,
        refreshToken: response.data?.refreshToken,
        tokenExpiresAt: response.data?.tokenExpiresAt || null,
        refreshTokenExpiresAt: response.data?.refreshTokenExpiresAt || null,
      };

      if (!newUser.token || !newUser.refreshToken) {
        return false;
      }
      setUser(newUser);
      localStorage.setItem('transpo_user', JSON.stringify(newUser));
      return true;
    } catch (err) {
      console.error('Login failed', err);
      return false;
    }
  };

  const adminLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiService.login({ email, password });
      if (!response?.success) return false;

      const role = response.data?.user?.role || response.data?.role;
      if (role !== 'admin') return false;

      const newUser: User = {
        id: response.data?.user?.id || response.data?.id,
        name: response.data?.user?.name || response.data?.name,
        phone: response.data?.user?.phone || response.data?.phone || 'N/A',
        email: response.data?.user?.email || response.data?.email,
        role: role as UserRole,
        token: response.data?.token,
        refreshToken: response.data?.refreshToken,
        tokenExpiresAt: response.data?.tokenExpiresAt || null,
        refreshTokenExpiresAt: response.data?.refreshTokenExpiresAt || null,
      };

      if (!newUser.token || !newUser.refreshToken) return false;

      setUser(newUser);
      localStorage.setItem('transpo_user', JSON.stringify(newUser));
      return true;
    } catch (err) {
      console.error('Admin login failed', err);
      return false;
    }
  };

  const logout = () => {
    try {
      const saved = localStorage.getItem('transpo_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.refreshToken) {
          apiService.logout(parsed.refreshToken).catch(() => {});
        }
      }
    } catch {}
    setUser(null);
    localStorage.removeItem('transpo_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin: user?.role === 'admin',
      login,
      adminLogin,
      logout,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
