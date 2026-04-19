'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="w-full max-w-xl bg-white border-4 border-black rounded-[32px] p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] space-y-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Application Error</div>
        <div className="text-2xl font-black uppercase tracking-tighter">Something went wrong</div>
        <div className="text-sm font-bold text-zinc-600 break-words">
          {error?.message || 'An unexpected error occurred.'}
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="bg-yellow-400 border-4 border-black rounded-2xl px-6 py-3 font-black uppercase text-xs shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:scale-95"
          >
            Retry
          </button>
          <Link
            href="/"
            className="bg-black text-yellow-400 border-4 border-black rounded-2xl px-6 py-3 font-black uppercase text-xs shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
