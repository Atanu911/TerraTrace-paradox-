"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapPin, X, Navigation, ExternalLink, Maximize2, ZoomIn, ZoomOut,
  Globe2, Layers, AlertTriangle, TreePine, Pickaxe, HardHat, Flame,
  Download, FileText, BarChart3
} from "lucide-react";
import type { HotspotItem } from "@/lib/api";
import { api } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface LocationMapModalProps {
  hotspot: HotspotItem;
  onClose: () => void;
  onViewReport?: () => void;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  Deforestation: <TreePine className="h-3.5 w-3.5" />,
  Mining: <Pickaxe className="h-3.5 w-3.5" />,
  Construction: <HardHat className="h-3.5 w-3.5" />,
  Heatmap: <Flame className="h-3.5 w-3.5" />,
  Other: <AlertTriangle className="h-3.5 w-3.5" />,
};
const ACTIVITY_COLORS: Record<string, string> = {
  Deforestation: "text-emerald-300",
  Mining: "text-amber-300",
  Construction: "text-rose-300",
  Heatmap: "text-orange-300",
  Other: "text-cyan-300",
};

const formatArea = (ha: number) =>
  ha >= 100 ? `${(ha / 100).toFixed(1)} km²` : `${ha.toFixed(1)} ha`;

export default function LocationMapModal({
  hotspot,
  onClose,
  onViewReport,
}: LocationMapModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mapType, setMapType] = useState<"satellite" | "terrain" | "3d">("satellite");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Entry animation
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
        setIsExpanding(true);
      });
    });
    // Build PDF URL
    setPdfUrl(`${API_BASE}/api/reports/location/${hotspot.id}/download`);

    // Prevent background scroll
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [hotspot.id]);

  const handleClose = () => {
    setIsVisible(false);
    setIsExpanding(false);
    setTimeout(onClose, 350);
  };

  // Map embed URL — switches between satellite, terrain, 3D views
  const buildMapUrl = () => {
    const { latitude: lat, longitude: lon } = hotspot;
    const zoom = 13;
    if (mapType === "satellite") {
      return `https://maps.google.com/maps?q=${lat},${lon}&t=k&z=${zoom}&ie=UTF8&iwloc=&output=embed`;
    }
    if (mapType === "terrain") {
      return `https://maps.google.com/maps?q=${lat},${lon}&t=p&z=${zoom}&ie=UTF8&iwloc=&output=embed`;
    }
    // 3D view: use Google Earth
    return `https://earth.google.com/web/@${lat},${lon},500a,8000d,35y,0h,60t,0r`;
  };

  const googleMapsUrl = `https://maps.google.com/maps?q=${hotspot.latitude},${hotspot.longitude}&t=k&z=14`;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[200] flex items-stretch transition-all duration-350 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      style={{ backdropFilter: isVisible ? "blur(8px)" : "blur(0px)" }}
    >
      {/* Dark backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-350 ${
          isVisible ? "opacity-80" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Modal Container — expands from center */}
      <div
        className={`relative z-10 flex w-full h-full max-w-[1400px] mx-auto my-4 rounded-2xl overflow-hidden border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.8)] transition-all duration-400 ease-out ${
          isExpanding
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-8"
        }`}
        style={{
          background: "linear-gradient(135deg, #050f18 0%, #071a2a 100%)",
        }}
      >
        {/* ── LEFT: Location Detail Panel ──────────────────── */}
        <aside className="w-[340px] min-w-[320px] flex flex-col border-r border-white/[.07] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-b from-[#0a1f35] to-transparent p-5 border-b border-white/[.07]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/80 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  TERRATRACE LIVE MONITORING
                </div>
                <h2 className="text-base font-bold text-white leading-snug">{hotspot.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{hotspot.state}, India</p>
              </div>
              <button
                onClick={handleClose}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Coordinates */}
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[.07] bg-white/5 px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="font-mono text-xs text-cyan-300">
                {hotspot.latitude.toFixed(5)}°N, {hotspot.longitude.toFixed(5)}°E
              </span>
            </div>
          </div>

          {/* Map Type Switcher */}
          <div className="px-5 py-3 border-b border-white/[.05]">
            <p className="text-[10px] text-slate-500 mb-2">Map View</p>
            <div className="flex gap-2">
              {(["satellite", "terrain", "3d"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMapType(type)}
                  className={`flex-1 rounded-lg border py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                    mapType === type
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  {type === "3d" ? "3D" : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[.06] bg-white/5 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">Total Affected</p>
              <p className="text-sm font-bold text-amber-300 mt-0.5">{formatArea(hotspot.total_area_ha)}</p>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-white/5 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">Avg Confidence</p>
              <p className="text-sm font-bold text-emerald-300 mt-0.5">{hotspot.avg_confidence.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-white/5 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">ISFR Forest Trend</p>
              <p className={`text-sm font-bold mt-0.5 ${hotspot.forest_trend.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>
                {hotspot.forest_trend}
              </p>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-white/5 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">Minerals</p>
              <p className="text-xs font-bold text-white mt-0.5 truncate" title={hotspot.minerals}>
                {hotspot.minerals.split(",")[0]}
              </p>
            </div>
          </div>

          {/* Activity Breakdown */}
          <div className="px-5 pb-4 flex-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Detected Activities</p>
            <div className="space-y-2">
              {Object.entries(hotspot.type_counts).map(([type, count]) => {
                const icon = ACTIVITY_ICONS[type] || ACTIVITY_ICONS.Other;
                const colorClass = ACTIVITY_COLORS[type] || "text-cyan-300";
                const areaForType = hotspot.detections
                  .filter((d) => d.change_type === type)
                  .reduce((s, d) => s + d.area_hectares, 0);
                const avgConfForType =
                  hotspot.detections.filter((d) => d.change_type === type).reduce((s, d) => s + d.confidence, 0) /
                  Math.max(hotspot.detections.filter((d) => d.change_type === type).length, 1);
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-lg border border-white/[.06] bg-white/5 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={colorClass}>{icon}</span>
                      <div>
                        <p className={`text-xs font-semibold ${colorClass}`}>{type}</p>
                        <p className="text-[10px] text-slate-500">{count} event{count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white font-mono">{formatArea(areaForType)}</p>
                      <p className="text-[10px] text-slate-500">{avgConfForType.toFixed(1)}% conf</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 p-4 border-t border-white/[.07] bg-[#050f18]/90 space-y-2">
            {pdfUrl && (
              <button
                onClick={onViewReport || (() => window.open(pdfUrl, "_blank"))}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <FileText className="h-4 w-4" /> View Forensic Report
              </button>
            )}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:border-white/20 transition"
            >
              <ExternalLink className="h-4 w-4" /> Open in Google Maps
            </a>
            {pdfUrl && (
              <a
                href={pdfUrl}
                download
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 py-2.5 text-sm font-medium text-cyan-400 hover:bg-cyan-500/15 transition"
              >
                <Download className="h-4 w-4" /> Download PDF Report
              </a>
            )}
          </div>
        </aside>

        {/* ── RIGHT: Full Map ───────────────────────────────── */}
        <div className="flex-1 flex flex-col">
          {/* Map Toolbar */}
          <div className="flex items-center justify-between border-b border-white/[.07] bg-[#07172a]/80 px-5 py-3">
            <div className="flex items-center gap-3">
              <Globe2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">
                {hotspot.name}
              </span>
              <span className="text-xs text-slate-500">
                {mapType === "satellite" ? "Satellite Imagery" : mapType === "terrain" ? "Terrain View" : "3D Google Earth View"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:text-white transition"
              >
                <Navigation className="h-3.5 w-3.5" /> Directions
              </a>
              <button
                onClick={handleClose}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Map Iframe */}
          <div className="flex-1 relative bg-[#050f18]">
            {mapType === "3d" ? (
              /* 3D view — open link since Google Earth can't be embedded easily */
              <div className="flex h-full flex-col items-center justify-center gap-5 text-center p-8">
                <Globe2 className="h-16 w-16 text-emerald-400/40" />
                <div>
                  <h3 className="text-xl font-bold text-white">3D Google Earth View</h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-sm">
                    3D immersive Earth view requires Google Earth to be opened in a new tab.
                  </p>
                  <p className="text-xs font-mono text-cyan-400 mt-3">
                    {hotspot.latitude.toFixed(5)}°N, {hotspot.longitude.toFixed(5)}°E
                  </p>
                </div>
                <a
                  href={`https://earth.google.com/web/@${hotspot.latitude},${hotspot.longitude},500a,8000d,35y,0h,60t,0r`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-[#042018] hover:bg-emerald-400 transition"
                >
                  <Globe2 className="h-4 w-4" /> Open in Google Earth 3D
                </a>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-500 hover:text-cyan-400 transition"
                >
                  Or open in Google Maps satellite view →
                </a>
              </div>
            ) : (
              <iframe
                src={buildMapUrl()}
                className="w-full h-full border-0"
                title={`Map of ${hotspot.name}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            )}

            {/* Floating Info Overlay on Map */}
            {mapType !== "3d" && (
              <div className="absolute bottom-4 left-4 max-w-xs rounded-xl border border-white/10 bg-[#07172a]/90 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white">Active Monitoring Zone</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">{hotspot.description.slice(0, 120)}...</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(hotspot.type_counts).map(([type]) => {
                    const colorClass = ACTIVITY_COLORS[type] || "text-cyan-300";
                    return (
                      <span key={type} className={`text-[9px] font-medium ${colorClass}`}>
                        {ACTIVITY_ICONS[type]} {type}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
