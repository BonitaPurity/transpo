'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { user, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="min-h-full bg-black text-white">
        <div className="ui-page">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-full bg-black text-white">
        <div className="ui-page">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black text-white">
      <div className="ui-page">{children}</div>
    </div>
  );
}
