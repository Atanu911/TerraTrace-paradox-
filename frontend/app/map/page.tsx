"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Globe2, Map } from "lucide-react";
import SatelliteMapView from "@/components/map/SatelliteMapView";
import GlobeOverviewView from "@/components/map/GlobeOverviewView";

export default function MapPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-400">Loading map view...</div>}>
      <MapPageContent />
    </Suspense>
  );
}

function MapPageContent() {
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") === "satellite" ? "satellite" : "globe";
  const [viewMode, setViewMode] = useState<"globe" | "satellite">(initialView);

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)] w-full">
      {/* View Switcher Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[.07] bg-[#071320]/95 px-4 py-2.5 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase hidden sm:inline">
            Geospatial Intelligence
          </span>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#060E20]/90 p-1 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => setViewMode("globe")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "globe"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>3D Globe Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("satellite")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "satellite"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Map className="h-3.5 w-3.5 text-cyan-400" />
              <span>2D Satellite Map</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400 hidden md:block">
          {viewMode === "globe" ? "Earth-scale monitoring & alerts" : "High-resolution satellite polygon inspection"}
        </div>
      </div>

      {/* Main View Display */}
      <div className="flex-1">
        {viewMode === "globe" ? (
          <GlobeOverviewView onSwitchToMap={() => setViewMode("satellite")} />
        ) : (
          <div className="h-[calc(100vh-7rem)] w-full">
            <SatelliteMapView onSwitchToGlobe={() => setViewMode("globe")} showGlobeToggle={false} />
          </div>
        )}
      </div>
    </div>
  );
}
