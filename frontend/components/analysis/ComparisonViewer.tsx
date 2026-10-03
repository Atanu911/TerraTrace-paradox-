"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Columns2,
  Sliders,
  Layers,
  Repeat,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Map as MapIcon,
  Sparkles,
  Eye,
  Info,
  Clock,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import type { AnalysisResults, DetectionItem, LocationItem, ScanItem } from "@/lib/api";
import { api } from "@/lib/api";
import type { FeatureCollection, Geometry, Point } from "geojson";
import type { Map as MapboxMap } from "mapbox-gl";

export type ComparisonMode = "swipe" | "side-by-side" | "opacity" | "toggle";
export type MediaView = "raster" | "map";

export interface ComparisonViewerProps {
  scan: ScanItem | null;
  results: AnalysisResults | null;
  location?: LocationItem | null;
  className?: string;
  onDetectionSelect?: (detectionId: number) => void;
  selectedDetectionId?: number | null;
}

const CLASSIFICATION_COLORS: Record<string, { bg: string; border: string; text: string; hex: string }> = {
  Deforestation: { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300", hex: "#22c55e" },
  Mining: { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-300", hex: "#f59e0b" },
  Construction: { bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-300", hex: "#ef4444" },
  Other: { bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-300", hex: "#22d3ee" },
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Undated capture";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

function calculateDateDelta(d1?: string | null, d2?: string | null): string | null {
  if (!d1 || !d2) return null;
  try {
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) || isNaN(t2)) return null;
    const diffDays = Math.round(Math.abs(t2 - t1) / (1000 * 60 * 60 * 24));
    return `${diffDays} days interval`;
  } catch {
    return null;
  }
}

export default function ComparisonViewer({
  scan,
  results,
  location,
  className = "",
  onDetectionSelect,
  selectedDetectionId,
}: ComparisonViewerProps) {
  // Modes & UI controls
  const [mode, setMode] = useState<ComparisonMode>("swipe");
  const [mediaView, setMediaView] = useState<MediaView>("raster");
  const [swipePos, setSwipePos] = useState<number>(50); // 0 to 100%
  const [opacityVal, setOpacityVal] = useState<number>(50); // 0 (latest) to 100 (before)
  const [toggleActive, setToggleActive] = useState<"before" | "latest">("latest");
  const [autoBlink, setAutoBlink] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Raster inspection controls: pan & zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // Layer toggles
  const [rasterOverlayType, setRasterOverlayType] = useState<"overlay" | "heatmap" | "raw">("overlay");
  const [showPolygons, setShowPolygons] = useState<boolean>(true);
  const [activeClasses, setActiveClasses] = useState<Record<string, boolean>>({
    Deforestation: true,
    Mining: true,
    Construction: true,
    Other: true,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingSwipe = useRef<boolean>(false);

  // Mapbox maps synchronized refs
  const mapBeforeContainerRef = useRef<HTMLDivElement>(null);
  const mapLatestContainerRef = useRef<HTMLDivElement>(null);
  const mapBeforeRef = useRef<MapboxMap | null>(null);
  const mapLatestRef = useRef<MapboxMap | null>(null);
  const isSyncingMapsRef = useRef<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Dynamic dates
  const beforeDateStr = results?.scan_date_old || scan?.scan_date_old || null;
  const latestDateStr = results?.scan_date_new || scan?.scan_date_new || scan?.created_at || results?.created_at || null;
  const formattedBeforeDate = formatDate(beforeDateStr);
  const formattedLatestDate = formatDate(latestDateStr);
  const dateDelta = calculateDateDelta(beforeDateStr, latestDateStr);

  // Image URLs
  const beforeImageUrl = useMemo(() => {
    const p = scan?.old_thumbnail || scan?.old_image_path || results?.old_thumbnail || results?.old_image_path;
    return p ? api.getAssetUrl(p) : null;
  }, [scan, results]);

  const latestImageUrl = useMemo(() => {
    // If user chose heatmap
    if (rasterOverlayType === "heatmap" && results?.diff_heatmap_path) {
      return api.getAssetUrl(results.diff_heatmap_path);
    }
    // If user chose overlay
    if (rasterOverlayType === "overlay" && results?.detection_overlay_path) {
      return api.getAssetUrl(results.detection_overlay_path);
    }
    // Raw latest raster / aligned raster
    const p = results?.aligned_image_path || scan?.aligned_image_path || scan?.new_thumbnail || results?.new_thumbnail || scan?.new_image_path;
    return p ? api.getAssetUrl(p) : null;
  }, [rasterOverlayType, results, scan]);

  // GeoJSON features for Map view
  const detections = useMemo<DetectionItem[]>(() => {
    const list = results?.detections || [];
    return list.filter((d) => activeClasses[d.change_type] !== false);
  }, [results, activeClasses]);

  const geoJsonData = useMemo<FeatureCollection<Geometry>>(() => {
    return {
      type: "FeatureCollection",
      features: detections.map((det) => {
        const poly = det.polygon as { type?: string; coordinates?: [number, number][][] } | undefined;
        const hasPoly = poly?.type === "Polygon" && Boolean(poly.coordinates?.[0]?.length);
        const geometry: Geometry = hasPoly
          ? (poly as Geometry)
          : ({ type: "Point", coordinates: [det.centroid_lon, det.centroid_lat] } satisfies Point);

        return {
          type: "Feature",
          id: det.id,
          geometry,
          properties: {
            id: det.id,
            changeType: det.change_type,
            confidence: det.confidence,
            areaHa: det.area_hectares,
            isSelected: det.id === selectedDetectionId,
          },
        };
      }),
    };
  }, [detections, selectedDetectionId]);

  // Auto-blink toggle timer
  useEffect(() => {
    if (!autoBlink || mode !== "toggle") return;
    const interval = setInterval(() => {
      setToggleActive((prev) => (prev === "before" ? "latest" : "before"));
    }, 1200);
    return () => clearInterval(interval);
  }, [autoBlink, mode]);

  // Keyboard shortcut: Space toggles in toggle mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" && mode === "toggle") {
        e.preventDefault();
        setToggleActive((prev) => (prev === "before" ? "latest" : "before"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  // Swipe dragging handlers with pointer capture for buttery smooth tracking
  const handlePointerDownSwipe = (e: React.PointerEvent) => {
    isDraggingSwipe.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveSwipe = (e: React.PointerEvent) => {
    if (!isDraggingSwipe.current || !swipeContainerRef.current) return;
    const rect = swipeContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clamped = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSwipePos(clamped);
  };

  const handlePointerUpSwipe = (e: React.PointerEvent) => {
    if (isDraggingSwipe.current) {
      isDraggingSwipe.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
    }
  };

  // Pan handlers for raster inspection
  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: panOffset.x,
      initY: panOffset.y,
    };
  };

  const handlePanMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    setPanOffset({
      x: panStartRef.current.initX + dx,
      y: panStartRef.current.initY + dy,
    });
  };

  const handlePanMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoomLevel((prev) => Math.max(1, Math.min(4, Number((prev + delta).toFixed(2)))));
  };

  const resetTransform = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Mapbox Synchronized Dual Maps Setup
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (mediaView !== "map") return;
    if (!token) {
      setMapError("Mapbox access token is required to load the synchronized geospatial satellite map.");
      return;
    }

    let disposed = false;
    let mapA: MapboxMap | null = null;
    let mapB: MapboxMap | null = null;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (disposed) return;
      mapboxgl.accessToken = token;

      const center: [number, number] = location
        ? [location.longitude, location.latitude]
        : detections[0]
        ? [detections[0].centroid_lon, detections[0].centroid_lat]
        : [88.85, 22.02];
      const zoom = location || detections.length > 0 ? 12 : 3;

      // Init Map A (Before)
      if (mapBeforeContainerRef.current) {
        mapA = new mapboxgl.Map({
          container: mapBeforeContainerRef.current,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center,
          zoom,
          attributionControl: false,
        });
        mapBeforeRef.current = mapA;
      }

      // Init Map B (Latest)
      if (mapLatestContainerRef.current) {
        mapB = new mapboxgl.Map({
          container: mapLatestContainerRef.current,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center,
          zoom,
          attributionControl: false,
        });
        mapLatestRef.current = mapB;
      }

      const syncMaps = (source: MapboxMap, target: MapboxMap) => {
        if (isSyncingMapsRef.current) return;
        isSyncingMapsRef.current = true;
        const c = source.getCenter();
        const z = source.getZoom();
        const b = source.getBearing();
        const p = source.getPitch();

        target.jumpTo({ center: c, zoom: z, bearing: b, pitch: p });
        isSyncingMapsRef.current = false;
      };

      const onMoveA = () => {
        if (mapA && mapB) syncMaps(mapA, mapB);
      };
      const onMoveB = () => {
        if (mapB && mapA) syncMaps(mapB, mapA);
      };

      mapA?.on("move", onMoveA);
      mapB?.on("move", onMoveB);

      // Add GeoJSON overlay layers to Map B (Latest)
      mapB?.on("load", () => {
        if (disposed || !mapB) return;
        mapB.addSource("detections-source", {
          type: "geojson",
          data: geoJsonData,
        });

        // Polygon fills
        mapB.addLayer({
          id: "detections-fill",
          type: "fill",
          source: "detections-source",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "fill-color": [
              "match",
              ["get", "changeType"],
              "Deforestation", "#22c55e",
              "Mining", "#f59e0b",
              "Construction", "#ef4444",
              "#22d3ee",
            ],
            "fill-opacity": showPolygons ? 0.45 : 0,
          },
        });

        // Polygon borders
        mapB.addLayer({
          id: "detections-line",
          type: "line",
          source: "detections-source",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "line-color": [
              "match",
              ["get", "changeType"],
              "Deforestation", "#22c55e",
              "Mining", "#f59e0b",
              "Construction", "#ef4444",
              "#22d3ee",
            ],
            "line-width": 2.5,
            "line-opacity": showPolygons ? 0.9 : 0,
          },
        });

        // Points
        mapB.addLayer({
          id: "detections-points",
          type: "circle",
          source: "detections-source",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 7,
            "circle-color": [
              "match",
              ["get", "changeType"],
              "Deforestation", "#22c55e",
              "Mining", "#f59e0b",
              "Construction", "#ef4444",
              "#22d3ee",
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": showPolygons ? 0.95 : 0,
          },
        });

        // Click handler to select detection
        mapB.on("click", "detections-fill", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "number") onDetectionSelect?.(id);
        });
      });
    });

    return () => {
      disposed = true;
      mapBeforeRef.current?.remove();
      mapLatestRef.current?.remove();
      mapBeforeRef.current = null;
      mapLatestRef.current = null;
    };
  }, [mediaView, token, location, detections, geoJsonData, onDetectionSelect, showPolygons]);

  // Update polygon opacity dynamically on Map B
  useEffect(() => {
    if (mapLatestRef.current && mapLatestRef.current.isStyleLoaded()) {
      if (mapLatestRef.current.getLayer("detections-fill")) {
        mapLatestRef.current.setPaintProperty("detections-fill", "fill-opacity", showPolygons ? 0.45 : 0);
      }
      if (mapLatestRef.current.getLayer("detections-line")) {
        mapLatestRef.current.setPaintProperty("detections-line", "line-opacity", showPolygons ? 0.9 : 0);
      }
      if (mapLatestRef.current.getLayer("detections-points")) {
        mapLatestRef.current.setPaintProperty("detections-points", "circle-opacity", showPolygons ? 0.95 : 0);
      }
    }
  }, [showPolygons]);

  return (
    <div
      ref={containerRef}
      className={`glass-panel rounded-2xl border border-cyan-500/25 bg-[#06121f]/95 shadow-[0_12px_48px_rgba(0,0,0,0.5)] transition-all flex flex-col overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none p-6" : "p-5"
      } ${className}`}
    >
      {/* ── HEADER TOOLBAR ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        {/* Left: Mode Title & Dynamic Scan Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold text-white tracking-wide">
                  Before vs Latest Comparison Engine
                </h3>
                <span className="rounded bg-blue-900/60 border border-blue-700/50 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                  {mediaView === "raster" ? "Forensic Raster" : "Mapbox Geospatial"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Multi-temporal ground truth verification · Synchronized inspection
              </p>
            </div>
          </div>
        </div>

        {/* Right: View Switcher (Raster vs Satellite Map) & Fullscreen */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Media View Toggle: Raster Imagery vs Interactive Geospatial Map */}
          <div className="flex items-center rounded-lg border border-white/10 bg-[#071726] p-1 font-mono text-xs">
            <button
              type="button"
              onClick={() => setMediaView("raster")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                mediaView === "raster"
                  ? "bg-cyan-600 text-white font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Satellite Rasters</span>
            </button>
            <button
              type="button"
              onClick={() => setMediaView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                mediaView === "map"
                  ? "bg-cyan-600 text-white font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Mapbox Satellite</span>
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#071726] text-slate-300 hover:text-white hover:border-cyan-400/50 transition-all"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── SECONDARY CONTROL BAR: COMPARISON MODES & METRICS ────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-white/[0.06] text-xs font-mono">
        {/* 4 COMPARISON MODES TABS */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#040e19] p-1 shadow-inner">
          <button
            type="button"
            onClick={() => setMode("swipe")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              mode === "swipe"
                ? "bg-blue-600 text-white font-bold shadow-[0_0_14px_rgba(37,99,235,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Swipe Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("side-by-side")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              mode === "side-by-side"
                ? "bg-blue-600 text-white font-bold shadow-[0_0_14px_rgba(37,99,235,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Columns2 className="h-3.5 w-3.5" />
            <span>Side-by-Side</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("opacity")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              mode === "opacity"
                ? "bg-blue-600 text-white font-bold shadow-[0_0_14px_rgba(37,99,235,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Opacity Blend</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("toggle")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              mode === "toggle"
                ? "bg-blue-600 text-white font-bold shadow-[0_0_14px_rgba(37,99,235,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Repeat className="h-3.5 w-3.5" />
            <span>Toggle Switch</span>
          </button>
        </div>

        {/* Dynamic Scan Dates Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Before Date Badge */}
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400/70 font-semibold uppercase">Before:</span>
            <span className="font-semibold">{formattedBeforeDate}</span>
          </div>

          {/* Date Delta Badge */}
          {dateDelta && (
            <span className="rounded bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 text-[10px] text-cyan-300">
              Δ {dateDelta}
            </span>
          )}

          {/* Latest Date Badge */}
          <div className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-950/40 px-2.5 py-1 text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            <span className="text-[10px] text-rose-400/70 font-semibold uppercase">Latest:</span>
            <span className="font-semibold">{formattedLatestDate}</span>
          </div>

          {/* GSD Resolution Badge */}
          {scan?.gsd_meters && (
            <span className="rounded bg-slate-800/60 border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">
              GSD: {scan.gsd_meters}m
            </span>
          )}
        </div>
      </div>

      {/* ── MODE-SPECIFIC SUB-CONTROLS ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs font-mono text-slate-300">
        {/* Swipe Mode Sub-Control */}
        {mode === "swipe" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Sliders className="h-3 w-3 text-cyan-400" />
              Divider Position:
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={swipePos}
              onChange={(e) => setSwipePos(Number(e.target.value))}
              className="w-36 sm:w-48 accent-cyan-400 cursor-pointer"
            />
            <span className="text-cyan-300 font-bold min-w-10">{swipePos.toFixed(0)}%</span>
            <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-500">
              <span>(Drag vertical divider or slider)</span>
            </div>
          </div>
        )}

        {/* Opacity Mode Sub-Control */}
        {mode === "opacity" && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <span className="text-slate-400 text-[11px]">Before Opacity:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={opacityVal}
              onChange={(e) => setOpacityVal(Number(e.target.value))}
              className="w-36 sm:w-48 accent-emerald-400 cursor-pointer"
            />
            <span className="text-emerald-300 font-bold min-w-12">{opacityVal}%</span>

            {/* Opacity Preset Buttons */}
            <div className="flex items-center gap-1">
              {[0, 25, 50, 75, 100].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setOpacityVal(step)}
                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                    opacityVal === step
                      ? "border-emerald-400 bg-emerald-950 text-white font-bold"
                      : "border-white/10 bg-[#071726] text-slate-400 hover:text-white"
                  }`}
                >
                  {step}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggle Mode Sub-Control */}
        {mode === "toggle" && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center rounded-lg border border-white/10 bg-[#071726] p-0.5">
              <button
                type="button"
                onClick={() => setToggleActive("before")}
                className={`px-3 py-1 rounded text-xs transition-all ${
                  toggleActive === "before"
                    ? "bg-emerald-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Before
              </button>
              <button
                type="button"
                onClick={() => setToggleActive("latest")}
                className={`px-3 py-1 rounded text-xs transition-all ${
                  toggleActive === "latest"
                    ? "bg-rose-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Latest
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAutoBlink((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-all ${
                autoBlink
                  ? "border-cyan-400 bg-cyan-950/60 text-cyan-200 animate-pulse"
                  : "border-white/10 bg-[#071726] text-slate-400 hover:text-white"
              }`}
            >
              <Repeat className="h-3 w-3" />
              <span>Auto Blink {autoBlink ? "ON" : "OFF"}</span>
            </button>
            <span className="text-[10px] text-slate-500 hidden sm:inline">(Press Space to switch)</span>
          </div>
        )}

        {/* Side-by-Side Zoom & Pan Sub-Control */}
        {mediaView === "raster" && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
              disabled={zoomLevel <= 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-[#071726] text-slate-300 hover:text-white disabled:opacity-40"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-cyan-300 font-semibold min-w-10 text-center">{zoomLevel}x</span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
              disabled={zoomLevel >= 4}
              className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-[#071726] text-slate-300 hover:text-white disabled:opacity-40"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            {(zoomLevel > 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
              <button
                type="button"
                onClick={resetTransform}
                className="flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-[#071726] text-slate-400 hover:text-white text-[10px]"
                title="Reset zoom & pan"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}

        {/* Raster Overlay Selector (Raw vs Overlay vs Diff Heatmap) */}
        {mediaView === "raster" && (
          <div className="flex items-center gap-1 rounded border border-white/10 bg-[#071726] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setRasterOverlayType("overlay")}
              className={`px-2 py-0.5 rounded transition-all ${
                rasterOverlayType === "overlay" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Mask Overlay
            </button>
            <button
              type="button"
              onClick={() => setRasterOverlayType("heatmap")}
              className={`px-2 py-0.5 rounded transition-all ${
                rasterOverlayType === "heatmap" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Diff Heatmap
            </button>
            <button
              type="button"
              onClick={() => setRasterOverlayType("raw")}
              className={`px-2 py-0.5 rounded transition-all ${
                rasterOverlayType === "raw" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Raw Incident
            </button>
          </div>
        )}
      </div>

      {/* ── MAIN COMPARISON CANVAS ───────────────────────────────── */}
      <div className="relative mt-3 flex-1 min-h-[460px] sm:min-h-[520px] w-full rounded-xl bg-black overflow-hidden border border-white/10 select-none shadow-inner">
        {/* Loading / Missing States */}
        {!beforeImageUrl && !latestImageUrl && mediaView === "raster" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-400 font-mono">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="text-sm font-semibold text-slate-300">
              No comparison rasters are loaded for this scan.
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              Upload multi-temporal images on the left panel or select a quick demo scan to initiate automated alignment and change detection.
            </p>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────── */}
        {/* 1. MEDIA VIEW: HIGH-RES FORENSIC SATELLITE RASTERS       */}
        {/* ───────────────────────────────────────────────────────── */}
        {mediaView === "raster" && (beforeImageUrl || latestImageUrl) && (
          <div
            className={`relative h-full w-full ${zoomLevel > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
            onMouseDown={zoomLevel > 1 ? handlePanMouseDown : undefined}
            onMouseMove={zoomLevel > 1 ? handlePanMouseMove : undefined}
            onMouseUp={zoomLevel > 1 ? handlePanMouseUp : undefined}
            onWheel={handleWheelZoom}
          >
            {/* TRANSFORM CONTAINER FOR SYNCHRONIZED PAN & ZOOM */}
            <div
              className="absolute inset-0 w-full h-full transition-transform duration-75"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                transformOrigin: "center center",
              }}
            >
              {/* ── A. SWIPE MODE (RASTER) ────────────────────── */}
              {mode === "swipe" && (
                <div
                  ref={swipeContainerRef}
                  className="relative h-full w-full select-none cursor-ew-resize overflow-hidden"
                  onPointerDown={handlePointerDownSwipe}
                  onPointerMove={handlePointerMoveSwipe}
                  onPointerUp={handlePointerUpSwipe}
                >
                  {/* Latest Image (Background Right) */}
                  {latestImageUrl ? (
                    <Image
                      src={latestImageUrl}
                      fill
                      unoptimized
                      alt="Latest satellite pass"
                      className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
                      Latest pass unavailable
                    </div>
                  )}

                  {/* Before Image (Clipped Left) */}
                  <div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{ clipPath: `inset(0 ${100 - swipePos}% 0 0)` }}
                  >
                    {beforeImageUrl ? (
                      <Image
                        src={beforeImageUrl}
                        fill
                        unoptimized
                        alt="Before satellite pass"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#091522] text-slate-500 text-xs">
                        Before pass unavailable
                      </div>
                    )}
                  </div>

                  {/* Divider Line & Drag Handle */}
                  <div
                    className="absolute top-0 bottom-0 z-30 w-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee] pointer-events-none -translate-x-1/2"
                    style={{ left: `${swipePos}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-blue-600 border-2 border-white shadow-[0_0_12px_rgba(0,0,0,0.8)] flex items-center justify-center text-white text-xs font-bold pointer-events-auto cursor-ew-resize">
                      ↔
                    </div>
                  </div>

                  {/* Badges on Screen */}
                  <div className="absolute top-4 left-4 z-20 pointer-events-none rounded-lg border border-emerald-500/40 bg-emerald-950/80 px-2.5 py-1 text-[11px] font-mono font-bold text-emerald-300 backdrop-blur-md">
                    BEFORE: {formattedBeforeDate}
                  </div>
                  <div className="absolute top-4 right-4 z-20 pointer-events-none rounded-lg border border-rose-500/40 bg-rose-950/80 px-2.5 py-1 text-[11px] font-mono font-bold text-rose-300 backdrop-blur-md">
                    LATEST: {formattedLatestDate}
                  </div>
                </div>
              )}

              {/* ── B. SIDE-BY-SIDE MODE (RASTER) ─────────────── */}
              {mode === "side-by-side" && (
                <div className="grid grid-cols-2 h-full w-full divide-x-2 divide-cyan-500/30">
                  {/* Left: Before Pass */}
                  <div className="relative h-full w-full overflow-hidden bg-[#061019]">
                    {beforeImageUrl ? (
                      <Image
                        src={beforeImageUrl}
                        fill
                        unoptimized
                        alt="Before satellite pass"
                        className="h-full w-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500 text-xs font-mono">
                        Before image unavailable
                      </div>
                    )}
                    <div className="absolute top-3 left-3 z-10 rounded-md border border-emerald-500/40 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-mono text-emerald-300 backdrop-blur">
                      BEFORE · {formattedBeforeDate}
                    </div>
                  </div>

                  {/* Right: Latest Pass with Detection Overlay */}
                  <div className="relative h-full w-full overflow-hidden bg-[#061019]">
                    {latestImageUrl ? (
                      <Image
                        src={latestImageUrl}
                        fill
                        unoptimized
                        alt="Latest satellite pass with detections"
                        className="h-full w-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500 text-xs font-mono">
                        Latest image unavailable
                      </div>
                    )}
                    <div className="absolute top-3 right-3 z-10 rounded-md border border-rose-500/40 bg-rose-950/85 px-2 py-0.5 text-[10px] font-mono text-rose-300 backdrop-blur">
                      LATEST · {formattedLatestDate}
                    </div>
                  </div>
                </div>
              )}

              {/* ── C. OPACITY MODE (RASTER) ──────────────────── */}
              {mode === "opacity" && (
                <div className="relative h-full w-full overflow-hidden">
                  {/* Background: Latest Image */}
                  {latestImageUrl ? (
                    <Image
                      src={latestImageUrl}
                      fill
                      unoptimized
                      alt="Latest satellite pass"
                      className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                    />
                  ) : null}

                  {/* Foreground: Before Image with dynamic opacity */}
                  {beforeImageUrl ? (
                    <div
                      className="absolute inset-0 pointer-events-none transition-opacity duration-150"
                      style={{ opacity: opacityVal / 100 }}
                    >
                      <Image
                        src={beforeImageUrl}
                        fill
                        unoptimized
                        alt="Before satellite pass"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : null}

                  {/* Badge */}
                  <div className="absolute bottom-4 left-4 z-20 rounded-lg border border-white/10 bg-[#06121c]/90 px-3 py-1.5 text-[11px] font-mono text-slate-200 backdrop-blur">
                    <span>Blending: </span>
                    <strong className="text-emerald-400">{opacityVal}% Before</strong>
                    <span className="text-slate-500"> / </span>
                    <strong className="text-rose-400">{100 - opacityVal}% Latest</strong>
                  </div>
                </div>
              )}

              {/* ── D. TOGGLE MODE (RASTER) ───────────────────── */}
              {mode === "toggle" && (
                <div className="relative h-full w-full overflow-hidden">
                  {toggleActive === "before" ? (
                    beforeImageUrl ? (
                      <Image
                        src={beforeImageUrl}
                        fill
                        unoptimized
                        alt="Before satellite pass"
                        className="h-full w-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500 text-xs font-mono">
                        Before raster missing
                      </div>
                    )
                  ) : latestImageUrl ? (
                    <Image
                      src={latestImageUrl}
                      fill
                      unoptimized
                      alt="Latest satellite pass"
                      className="h-full w-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500 text-xs font-mono">
                      Latest raster missing
                    </div>
                  )}

                  {/* Active Toggle Status Pill */}
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-[#06121c]/90 px-3 py-1.5 text-xs font-mono backdrop-blur">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        toggleActive === "before" ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    <span className="font-bold text-white uppercase">
                      Viewing: {toggleActive === "before" ? `BEFORE (${formattedBeforeDate})` : `LATEST (${formattedLatestDate})`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────── */}
        {/* 2. MEDIA VIEW: MAPBOX SYNCHRONIZED DUAL SATELLITE MAPS   */}
        {/* ───────────────────────────────────────────────────────── */}
        {mediaView === "map" && (
          <div className="relative h-full w-full">
            {mapError && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-[#06121e] p-6 text-center text-rose-300 font-mono text-xs">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
                <p>{mapError}</p>
              </div>
            )}

            {/* In side-by-side or swipe or toggle for map view */}
            <div
              className={`h-full w-full ${
                mode === "side-by-side" ? "grid grid-cols-2 divide-x-2 divide-cyan-500/30" : "relative"
              }`}
            >
              {/* Map A: Before Pass */}
              <div
                className={`relative h-full w-full ${
                  mode === "toggle" && toggleActive !== "before" ? "hidden" : ""
                } ${mode === "swipe" ? "absolute inset-0" : ""}`}
                style={
                  mode === "swipe" ? { clipPath: `inset(0 ${100 - swipePos}% 0 0)`, zIndex: 10 } : undefined
                }
              >
                <div ref={mapBeforeContainerRef} className="h-full w-full" />
                <div className="absolute top-3 left-3 z-10 rounded-md border border-emerald-500/40 bg-emerald-950/85 px-2.5 py-1 text-[11px] font-mono text-emerald-300 backdrop-blur shadow">
                  BEFORE MAP · {formattedBeforeDate}
                </div>
              </div>

              {/* Map B: Latest Pass with GeoJSON Anomaly Overlay */}
              <div
                className={`relative h-full w-full ${
                  mode === "toggle" && toggleActive !== "latest" ? "hidden" : ""
                } ${mode === "swipe" ? "absolute inset-0" : ""}`}
              >
                <div ref={mapLatestContainerRef} className="h-full w-full" />
                <div className="absolute top-3 right-3 z-10 rounded-md border border-rose-500/40 bg-rose-950/85 px-2.5 py-1 text-[11px] font-mono text-rose-300 backdrop-blur shadow">
                  LATEST MAP · {formattedLatestDate}
                </div>
              </div>

              {/* Map Swipe Divider Handle */}
              {mode === "swipe" && (
                <div
                  ref={swipeContainerRef}
                  className="absolute inset-0 z-20 cursor-ew-resize"
                  onPointerDown={handlePointerDownSwipe}
                  onPointerMove={handlePointerMoveSwipe}
                  onPointerUp={handlePointerUpSwipe}
                >
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee] pointer-events-none -translate-x-1/2"
                    style={{ left: `${swipePos}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-blue-600 border-2 border-white shadow-[0_0_12px_rgba(0,0,0,0.8)] flex items-center justify-center text-white text-xs font-bold pointer-events-auto cursor-ew-resize">
                      ↔
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scanline decoration */}
        <div className="scanline-beam pointer-events-none" />
      </div>

      {/* ── FOOTER CLASSIFICATION PILLS & GEOJSON CONTROLS ──────── */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.08] text-xs font-mono text-slate-400">
        {/* Classification Filter Legend */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 uppercase font-semibold">Change Classes:</span>
          {Object.entries(CLASSIFICATION_COLORS).map(([cName, cStyle]) => {
            const count = results?.change_type_counts?.[cName] ?? 0;
            const isEnabled = activeClasses[cName] !== false;
            return (
              <button
                key={cName}
                type="button"
                onClick={() =>
                  setActiveClasses((prev) => ({ ...prev, [cName]: !isEnabled }))
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-all ${
                  isEnabled
                    ? `${cStyle.bg} ${cStyle.border} ${cStyle.text} font-semibold`
                    : "border-white/10 bg-slate-900/50 text-slate-500 opacity-60"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isEnabled ? cStyle.hex : "#64748b" }}
                />
                <span>{cName}</span>
                {count > 0 && <span className="opacity-75">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Total Detected Metrics Summary */}
        <div className="flex items-center gap-3 text-[11px] text-slate-300">
          {results && (
            <>
              <div>
                <span>Total Detected: </span>
                <strong className="text-white font-bold">{results.total_area_ha} ha</strong>
              </div>
              <span>•</span>
              <div>
                <span>Mean Confidence: </span>
                <strong className="text-emerald-400 font-bold">{results.avg_confidence}%</strong>
              </div>
              {results.alignment_quality !== undefined && (
                <>
                  <span>•</span>
                  <div>
                    <span>Alignment Score: </span>
                    <strong className="text-cyan-300 font-bold">{results.alignment_quality}%</strong>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
