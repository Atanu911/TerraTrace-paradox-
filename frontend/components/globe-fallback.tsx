"use client";

import { Globe2 } from "lucide-react";

// Temporary fallback component until cobe is installed
export function GlobeFallback() {
  return (
    <div className="relative aspect-square w-full select-none overflow-visible">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-[10%] rounded-full bg-cyan-400/10 blur-[70px]" />
      <div className="pointer-events-none absolute inset-[18%] rounded-full bg-emerald-400/5 blur-[45px]" />
      
      {/* Outer rings */}
      <div className="pointer-events-none absolute inset-[4%] rounded-full border border-cyan-400/10" />
      <div 
        className="pointer-events-none absolute inset-[7%] rounded-full border border-dashed border-cyan-400/10"
        style={{ animation: "rotate 35s linear infinite" }}
      />
      
      {/* Main globe placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-64 h-64 rounded-full border-2 border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center">
          <Globe2 className="w-24 h-24 text-cyan-400 opacity-60" />
          
          {/* Rotating markers */}
          <div className="absolute top-8 left-12 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <div className="absolute top-16 right-8 w-2 h-2 rounded-full bg-red-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-12 left-8 w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-8 right-16 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '1.5s' }} />
        </div>
      </div>
      
      {/* Status indicators */}
      <div className="absolute left-1/2 top-[3%] z-20 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-[#06151d]/80 px-3 py-1.5 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="font-mono text-[9px] font-semibold tracking-[0.2em] text-cyan-300">
            LIVE SATELLITE NETWORK
          </span>
        </div>
      </div>
      
      {/* Bottom cards */}
      <div className="absolute bottom-[5%] left-[5%] z-20 rounded-xl border border-cyan-400/15 bg-[#06151d]/75 px-4 py-3 backdrop-blur-xl">
        <div className="mb-1 font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">
          Install Required
        </div>
        <div className="flex items-end gap-2">
          <span className="text-lg font-bold tracking-tight text-white">cobe</span>
          <span className="mb-1 text-[9px] font-medium text-emerald-400">PACKAGE</span>
        </div>
      </div>
      
      <div className="absolute right-[5%] bottom-[5%] z-20 rounded-xl border border-emerald-400/15 bg-[#06151d]/75 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-amber-300">
            FALLBACK MODE
          </span>
        </div>
        <div className="mt-1 text-[8px] text-slate-500">npm install cobe</div>
      </div>
      
      <style jsx>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}