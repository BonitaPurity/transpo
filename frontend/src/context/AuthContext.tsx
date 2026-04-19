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
        setUser(JSON.parse(restored));
      }
      setIsLoading(false);
      initialized.current = true;
    };
    initAuth();
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
      };

      if (!newUser.token) {
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
    const success = await login(email, password);
    if (!success) return false;
    
    // Additional check to ensure it's an admin
    const saved = localStorage.getItem('transpo_user');
    if (saved) {
      const u = JSON.parse(saved);
      if (u.role === 'admin') return true;
    }
    
    logout(); // Log out if not admin
    return false;
  };

  const logout = () => {
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
