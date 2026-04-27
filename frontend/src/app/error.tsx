'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
      <div className="max-w-lg w-full bg-zinc-950 border border-yellow-400/30 rounded-3xl p-8 space-y-4">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">Rendering Error</div>
        <div className="text-2xl font-black text-yellow-400">Something went wrong</div>
        <div className="text-sm font-bold text-white/60 break-words">{error?.message || 'Unknown error'}</div>
        <button
          onClick={reset}
          className="w-full bg-yellow-400 text-black font-black uppercase tracking-widest text-xs py-4 rounded-2xl border border-yellow-400"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

