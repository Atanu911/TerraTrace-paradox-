"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Compass,
  Map,
  Globe2,
  Clock,
} from "lucide-react";
import { GlobeLive } from "@/components/globe-live";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface LayerState {
  deforestation: boolean;
  mining:        boolean;
  construction:  boolean;
  changeDetect:  boolean;
  baseMap:       boolean;
}

interface DetectionPin {
  id: number;
  x: number; // percent from left
  y: number; // percent from top
  type: "deforestation" | "mining" | "construction" | "reforestation";
  label: string;
  area: string;
}

interface GISMapPanelProps {
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const LAYER_CONFIG = [
  { key: "deforestation" as const, label: "Deforestation",    color: "#00C49F", dot: "bg-[#00C49F]" },
  { key: "mining"        as const, label: "Mining",           color: "#F79009", dot: "bg-[#F79009]" },
  { key: "construction"  as const, label: "Construction",     color: "#FF4D4D", dot: "bg-[#FF4D4D]" },
  { key: "changeDetect"  as const, label: "Change Detection", color: "#00B4D8", dot: "bg-[#00B4D8]" },
  { key: "baseMap"       as const, label: "Base Map",         color: "#6366F1", dot: "bg-[#6366F1]" },
] as const;

const DEMO_PINS: DetectionPin[] = [
  { id: 1, x: 22,  y: 32, type: "deforestation", label: "Deforestation alert",   area: "3.2 km²" },
  { id: 2, x: 63,  y: 52, type: "mining",         label: "Mining activity",       area: "1.8 km²" },
  { id: 3, x: 44,  y: 68, type: "construction",   label: "Unauthorized structure",area: "0.9 km²" },
  { id: 4, x: 78,  y: 28, type: "reforestation",  label: "Reforestation zone",    area: "4.7 km²" },
  { id: 5, x: 14,  y: 71, type: "deforestation",  label: "Critical deforestation",area: "2.1 km²" },
];

const PIN_STYLE: Record<DetectionPin["type"], { ring: string; dot: string; label: string }> = {
  deforestation: { ring: "border-[#FF4D4D]", dot: "bg-[#FF4D4D]",   label: "text-[#FF4D4D]"  },
  mining:        { ring: "border-[#F79009]", dot: "bg-[#F79009]",   label: "text-[#F79009]"  },
  construction:  { ring: "border-[#00B4D8]", dot: "bg-[#00B4D8]",   label: "text-[#00B4D8]"  },
  reforestation: { ring: "border-[#00D284]", dot: "bg-[#00D284]",   label: "text-[#00D284]"  },
};

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function GISMapPanel({ className = "" }: GISMapPanelProps) {
  const [viewMode, setViewMode]   = useState<"satellite" | "globe">("satellite");
  const [layersOpen, setLayersOpen] = useState(false);
  const [layers, setLayers]       = useState<LayerState>({
    deforestation: true,
    mining:        true,
    construction:  true,
    changeDetect:  true,
    baseMap:       true,
  });
  const [zoom, setZoom] = useState(1);
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);

  const toggleLayer = (key: keyof LayerState) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const visiblePins = DEMO_PINS.filter((p) => {
    if (p.type === "deforestation" && !layers.deforestation) return false;
    if (p.type === "mining"        && !layers.mining)        return false;
    if (p.type === "construction"  && !layers.construction)  return false;
    return true;
  });

  return (
    <div className={`overflow-hidden rounded-xl border border-[#1D2D42] bg-[#101E2E] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] ${className}`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-[#1D2D42] px-4 py-3">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Satellite Map</span>
          <span className="rounded-full bg-[#16273B] px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-[#1D2D42]">
            Last 12 months
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[#1D2D42] bg-[#0B131F] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("satellite")}
              aria-pressed={viewMode === "satellite"}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                viewMode === "satellite"
                  ? "bg-[#16273B] text-white border border-[#1D2D42]"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Map className="h-3 w-3" /> Satellite
            </button>
            <button
              type="button"
              onClick={() => setViewMode("globe")}
              aria-pressed={viewMode === "globe"}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                viewMode === "globe"
                  ? "bg-[#16273B] text-white border border-[#1D2D42]"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Globe2 className="h-3 w-3" /> Globe
            </button>
          </div>

          {/* Layers button */}
          <button
            type="button"
            onClick={() => setLayersOpen(!layersOpen)}
            aria-expanded={layersOpen}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
              layersOpen
                ? "border-[#00D284]/40 bg-[#00D284]/10 text-[#00D284]"
                : "border-[#1D2D42] bg-[#0B131F] text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Layers
          </button>
        </div>
      </div>

      {/* ── Map Viewport ── */}
      <div className="relative" style={{ height: 480 }}>

        {viewMode === "satellite" ? (
          /* Satellite terrain background */
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              backgroundImage: `
                radial-gradient(ellipse at 20% 35%, rgba(34,197,94,0.22) 0%, transparent 45%),
                radial-gradient(ellipse at 70% 60%, rgba(234,88,12,0.18) 0%, transparent 40%),
                radial-gradient(ellipse at 45% 80%, rgba(247,144,9,0.15) 0%, transparent 35%),
                radial-gradient(ellipse at 85% 25%, rgba(16,185,129,0.18) 0%, transparent 38%),
                radial-gradient(ellipse at 55% 45%, rgba(15,23,42,0.6) 0%, transparent 55%),
                linear-gradient(145deg, #071d2e 0%, #0a2535 40%, #071925 70%, #050f18 100%)
              `,
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              transition: "transform 0.3s ease",
            }}
          >
            {/* Faint terrain grid lines */}
            <div
              className="absolute inset-0 opacity-[.04]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 80px)",
              }}
            />
            {/* Contour blobs */}
            <div className="absolute left-[8%] top-[20%] h-32 w-48 rounded-full bg-green-900/30 blur-3xl" />
            <div className="absolute left-[55%] top-[40%] h-24 w-32 rounded-full bg-orange-900/25 blur-2xl" />
            <div className="absolute left-[70%] top-[15%] h-36 w-36 rounded-full bg-emerald-900/25 blur-3xl" />
            <div className="absolute left-[30%] top-[60%] h-20 w-28 rounded-full bg-amber-900/20 blur-2xl" />
          </div>
        ) : (
          /* Globe view */
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_50%_48%,rgba(10,79,69,.18),transparent_58%),linear-gradient(180deg,#06151e,#061019)]">
            <div className="pointer-events-none absolute inset-0 opacity-20"
              style={{ backgroundImage: "linear-gradient(rgba(89,191,199,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(89,191,199,.08) 1px,transparent 1px)", backgroundSize: "52px 52px" }}
            />
            <div className="relative w-full max-w-[400px]">
              <GlobeLive speed={0.0014} />
            </div>
          </div>
        )}

        {/* Detection pins — satellite mode only */}
        {viewMode === "satellite" && visiblePins.map((pin) => {
          const s = PIN_STYLE[pin.type];
          const isHovered = hoveredPin === pin.id;
          return (
            <button
              key={pin.id}
              type="button"
              aria-label={`${pin.label} — ${pin.area}`}
              onMouseEnter={() => setHoveredPin(pin.id)}
              onMouseLeave={() => setHoveredPin(null)}
              onFocus={() => setHoveredPin(pin.id)}
              onBlur={() => setHoveredPin(null)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            >
              {/* Pulse ring 1 */}
              <span
                className={`absolute inset-0 rounded-full border-2 ${s.ring} radar-ping opacity-60`}
                style={{ margin: "-6px" }}
              />
              {/* Pulse ring 2 */}
              <span
                className={`absolute inset-0 rounded-full border ${s.ring} radar-ping-delay opacity-40`}
                style={{ margin: "-4px" }}
              />
              {/* Dot */}
              <span className={`relative z-10 block h-3.5 w-3.5 rounded-full border-2 border-white/20 ${s.dot}`} />

              {/* Tooltip */}
              {isHovered && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 min-w-[160px] rounded-xl border border-[#1D2D42] bg-[#101E2E]/95 px-3 py-2 text-left shadow-xl backdrop-blur-xl">
                  <p className={`text-[11px] font-semibold ${s.label}`}>{pin.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{pin.area}</p>
                </div>
              )}
            </button>
          );
        })}

        {/* ── Floating Layer Controls (top-left) ── */}
        {layersOpen && (
          <div className="absolute left-3 top-3 z-20 w-56 rounded-xl border border-[#1D2D42] bg-[#101E2E]/92 p-3.5 shadow-xl backdrop-blur-xl">
            <div className="mb-2.5 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-white">Map Layers</span>
            </div>

            <div className="space-y-1.5">
              {LAYER_CONFIG.map((layer) => {
                const isOn = layers[layer.key];
                return (
                  <button
                    key={layer.key}
                    type="button"
                    onClick={() => toggleLayer(layer.key)}
                    className={`layer-toggle flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                      isOn
                        ? "border-white/10 bg-white/5 text-slate-200"
                        : "border-transparent text-slate-500"
                    }`}
                    data-active={String(isOn)}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${layer.dot} ${!isOn ? "opacity-30" : ""}`} />
                    {layer.label}
                    <span className="ml-auto">
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded border-2 ${
                          isOn
                            ? "border-[#00D284] bg-[#00D284]/20"
                            : "border-slate-600 bg-transparent"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-[#1D2D42] pt-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Clock className="h-3 w-3" />
                <span>Time range: Last 12 months</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Right zoom controls ── */}
        {viewMode === "satellite" && (
          <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5">
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= 2}
              onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
              className="map-control flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 disabled:opacity-30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= 1}
              onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
              className="map-control flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 disabled:opacity-30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Reset north"
              onClick={() => setZoom(1)}
              className="map-control flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Compass className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Legend / scale bar (bottom-left) ── */}
        {viewMode === "satellite" && (
          <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-[#1D2D42] bg-[#0B131F]/85 px-3 py-2 text-[10px] text-slate-400 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-full bg-[#FF4D4D] shadow-[0_0_6px_rgba(255,77,77,0.8)]" />
                Critical
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-full bg-[#F79009] shadow-[0_0_6px_rgba(247,144,9,0.8)]" />
                Mining
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-full bg-[#00D284] shadow-[0_0_6px_rgba(0,210,132,0.8)]" />
                Reforestation
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-px w-10 bg-slate-400" />
              <span>0 — 5 km</span>
            </div>
          </div>
        )}

        {/* ── Satellite / Terrain toggle (bottom-right) ── */}
        <div className="absolute bottom-3 right-3 z-10">
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1D2D42] bg-[#0B131F]/85 px-3 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-sm transition-colors hover:border-cyan-400/30 hover:text-white"
          >
            <Map className="h-3.5 w-3.5" />
            Open full map
          </Link>
        </div>
      </div>
    </div>
  );
}
