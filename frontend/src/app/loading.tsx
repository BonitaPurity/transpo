'use client';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md bg-zinc-950 border border-yellow-400/20 rounded-3xl p-8 space-y-4">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30">Rendering</div>
        <div className="h-3 w-2/3 bg-white/10 rounded shimmer" />
        <div className="h-3 w-full bg-white/10 rounded shimmer" />
        <div className="h-3 w-5/6 bg-white/10 rounded shimmer" />
      </div>
    </div>
  );
}

