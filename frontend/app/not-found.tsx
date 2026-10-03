import Link from "next/link";
import { Radar, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="glass-panel rounded-3xl p-8 sm:p-12 border-blue-900/60 max-w-md w-full relative">
        <div className="hud-corner-tl" />
        <div className="hud-corner-tr" />
        <div className="hud-corner-bl" />
        <div className="hud-corner-br" />

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/40 bg-blue-950/80 mb-6 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
          <Radar className="h-7 w-7 text-cyan-400 animate-spin" />
        </div>

        <span className="font-mono text-xs text-cyan-400 font-bold tracking-wider">
          ERROR 404 // COORDINATE UNRESOLVED
        </span>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-2 mb-3">
          No Temporal Change Detected
        </h1>

        <p className="text-xs text-slate-300 font-mono mb-8 leading-relaxed">
          The requested coordinate or sector path does not exist in the active TerraTrace registry.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 py-3 text-xs font-mono font-semibold text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:scale-105 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Command Center</span>
        </Link>
      </div>
    </div>
  );
}
