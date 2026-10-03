"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { History, MapPin, Calendar } from "lucide-react";
import { api, LocationItem, ScanTimelineItem } from "@/lib/api";

export default function TimelinePage() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<number>(1);
  const [timelineData, setTimelineData] = useState<ScanTimelineItem[]>([]);
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  const loadTimeline = useCallback(async (locId: number) => {
    try {
      const data = await api.getLocationTimeline(locId);
      setTimelineData(data);
      if (data.length > 0) setActiveDateIndex(data.length - 1);
    } catch (e) {
      console.error("Timeline load failed:", e);
      setTimelineData([]);
    }
  }, []);

  useEffect(() => {
    api.getLocations().then((locs) => {
      setLocations(locs);
      if (locs.length > 0) {
        setSelectedLocation(locs[0].id);
        void loadTimeline(locs[0].id);
      }
    }).catch(() => setLocations([]));
  }, [loadTimeline]);

  const handleLocationChange = (locId: number) => {
    setSelectedLocation(locId);
    loadTimeline(locId);
  };

  const currentLoc = locations.find((l) => l.id === selectedLocation);

  const activePass = timelineData[activeDateIndex];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-900/40 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>TEMPORAL RECONSTRUCTION ENGINE</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Historical Change Progression
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Reconstruct temporal sequence of environmental loss and track progressive rate of land degradation.
          </p>
        </div>

        {/* Location Dropdown */}
        <div className="flex items-center gap-2 rounded-xl border border-blue-900/60 bg-[#071329] px-3 py-2 text-xs font-mono">
          <MapPin className="h-3.5 w-3.5 text-cyan-400" />
          <select
            value={selectedLocation}
            onChange={(e) => handleLocationChange(parseInt(e.target.value))}
            className="bg-transparent text-white focus:outline-none cursor-pointer"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id} className="bg-[#071329]">
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Temporal Scrubber Card */}
      <div className="glass-panel rounded-2xl p-6 border-blue-900/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-400" />
            <h2 className="font-display text-base font-bold text-white">
              Temporal Step Scrubber ({currentLoc?.name})
            </h2>
          </div>
          <span className="text-xs font-mono text-cyan-300">
            {timelineData.length} image {timelineData.length === 1 ? "pair" : "pairs"}
          </span>
        </div>

        {/* Timeline Steps Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {timelineData.map((pass, idx) => {
            const isSelected = activeDateIndex === idx;
            const passDate = new Date(pass.created_at).toLocaleString();
            return (
              <button
                type="button"
                key={idx}
                onClick={() => setActiveDateIndex(idx)}
                aria-pressed={isSelected}
                className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                  isSelected
                    ? "border-cyan-400 bg-blue-950/80"
                    : "border-blue-900/30 bg-[#071329]/60 hover:border-blue-800"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-cyan-400" />
                    <span>Pass T{idx}</span>
                  </span>
                  <span
                    className={`font-bold ${
                      idx === 0
                        ? "text-emerald-400"
                        : idx === 1
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {pass.status}
                  </span>
                </div>
                <h3 className="font-display text-sm font-bold text-white mb-1">
                  Scan #{pass.scan_id} · {passDate}
                </h3>
                <p className="text-xs text-slate-300 mb-2 font-mono">
                  Changed area: <strong>{pass.total_area_ha} ha</strong>
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {pass.detections_count} change candidates recorded
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Pass Visual Inspection Frame */}
        {activePass?.thumbnail ? (
          <div className="relative mx-auto aspect-[16/9] w-full max-w-4xl overflow-hidden rounded-xl border border-blue-900/60 bg-black shadow-[0_0_40px_rgba(0,10,30,0.8)]">
            <Image src={api.getAssetUrl(activePass.thumbnail)} alt={`Generated preview for scan ${activePass.scan_id}`} fill unoptimized sizes="(max-width: 896px) 100vw, 896px" className="object-cover" />
            <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-900/60 bg-[#060E20]/90 p-3 text-xs font-mono sm:inset-x-4 sm:bottom-4">
              <span className="text-cyan-200">Scan #{activePass.scan_id} · {new Date(activePass.created_at).toLocaleString()}</span>
              <span className="text-white">{activePass.total_area_ha} ha · {activePass.detections_count} candidates</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex aspect-[16/9] w-full max-w-4xl items-center justify-center rounded-xl border border-blue-900/60 bg-[#071329] p-6 text-center text-sm text-slate-400">
            {timelineData.length ? "No preview image is available for this scan." : "No scans are available for this location yet."}
          </div>
        )}
      </div>
    </div>
  );
}
