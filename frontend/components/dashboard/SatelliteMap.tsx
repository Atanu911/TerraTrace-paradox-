"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import Link from "next/link";
import { ArrowUpRight, Layers, ZoomIn, ZoomOut, Compass } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Detection pin data                                                   */
/* ------------------------------------------------------------------ */

export interface MapDetection {
  id: number;
  lat: number;
  lng: number;
  type: "deforestation" | "mining" | "construction" | "reforestation";
  label: string;
  area: string;
  confidence: number;
}

const DEFAULT_DETECTIONS: MapDetection[] = [
  { id: 1, lat: -1.28,  lng: 116.83, type: "deforestation", label: "Kalimantan, Indonesia",        area: "2.4 km²", confidence: 94 },
  { id: 2, lat:  0.51,  lng: 101.45, type: "mining",        label: "Mining — Riau, Indonesia",     area: "1.8 km²", confidence: 88 },
  { id: 3, lat: -6.20,  lng: 106.81, type: "construction",  label: "Unauthorized Construction",    area: "0.9 km²", confidence: 92 },
  { id: 4, lat: -3.47,  lng: -62.22, type: "deforestation", label: "Amazon Basin, Brazil",         area: "4.7 km²", confidence: 96 },
  { id: 5, lat:  4.21,  lng:  18.07, type: "reforestation", label: "Forest Regrowth — Congo",      area: "3.2 km²", confidence: 91 },
  { id: 6, lat: -0.79,  lng:  34.75, type: "mining",        label: "Mining — Lake Victoria, KE",   area: "1.1 km²", confidence: 85 },
];

const PIN_COLOR: Record<MapDetection["type"], string> = {
  deforestation: "#FF4D4D",
  mining:        "#F79009",
  construction:  "#00B4D8",
  reforestation: "#00D284",
};

const LAYER_LABELS: Record<string, string> = {
  satellite: "Satellite",
  terrain:   "Terrain",
  standard:  "Standard",
};

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

interface SatelliteMapProps {
  detections?: MapDetection[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  className?: string;
}

export default function SatelliteMap({
  detections = DEFAULT_DETECTIONS,
  center = { lat: 0, lng: 110 },
  zoom = 3,
  height = 500,
  className = "",
}: SatelliteMapProps) {
  const mapRef     = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapObjRef  = useRef<any>(null);

  const [layerMode, setLayerMode] = useState<"satellite" | "terrain" | "standard">("satellite");
  const [layerOpen, setLayerOpen] = useState(false);
  const [ready, setReady]         = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addTileLayer = (L: any, map: any, mode: string) => {
    const tiles = {
      satellite: L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri, Maxar, Earthstar Geographics", maxZoom: 18 }
      ),
      terrain: L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap, SRTM | Map style: © OpenTopoMap", maxZoom: 17 }
      ),
      standard: L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap contributors", maxZoom: 19 }
      ),
    };
    tiles[mode as keyof typeof tiles].addTo(map);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addMarkers = (L: any, map: any, pins: MapDetection[]) => {
    pins.forEach((pin) => {
      const color = PIN_COLOR[pin.type];

      // Custom SVG icon
      const svgIcon = L.divIcon({
        className: "",
        iconSize:  [28, 28],
        iconAnchor:[14, 14],
        html: `
          <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
            <span style="
              position:absolute;
              width:28px;height:28px;
              border-radius:50%;
              background:${color}30;
              animation:leaflet-ping 1.8s ease-out infinite;
            "></span>
            <span style="
              position:absolute;
              width:18px;height:18px;
              border-radius:50%;
              background:${color}40;
              animation:leaflet-ping 1.8s ease-out 0.6s infinite;
            "></span>
            <span style="
              position:relative;z-index:1;
              display:block;width:12px;height:12px;
              border-radius:50%;
              background:${color};
              border:2px solid white;
              box-shadow:0 0 10px ${color}80;
            "></span>
          </div>`,
      });

      const marker = L.marker([pin.lat, pin.lng], { icon: svgIcon });

      const changeClass = {
        deforestation: "color:#FF4D4D",
        mining:        "color:#F79009",
        construction:  "color:#00B4D8",
        reforestation: "color:#00D284",
      }[pin.type];

      marker.bindPopup(`
        <div style="background:#101E2E;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:12px;min-width:170px;color:#fff;font-family:Inter,sans-serif;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;${changeClass};margin-bottom:6px;">
            ${pin.type.replace("_", " ")}
          </div>
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">${pin.label}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#94A3B8;">
            <span>Area:</span><span style="color:#fff;font-weight:500;">${pin.area}</span>
            <span>Confidence:</span><span style="color:#00D284;font-weight:700;">${pin.confidence}%</span>
            <span>Lat/Lng:</span><span style="color:#94A3B8;">${pin.lat.toFixed(2)}, ${pin.lng.toFixed(2)}</span>
          </div>
        </div>`,
        {
          className:  "terratrace-popup",
          maxWidth:   220,
          closeButton: false,
        }
      );

      marker.addTo(map);
    });
  };

  /* ── Bootstrap Leaflet (client-only, no SSR) ── */
  useEffect(() => {
    if (typeof window === "undefined" || mapObjRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Function("return import('leaflet')")() as Promise<any>).then((L) => {
      leafletRef.current = L;

      // Fix default marker icon path issue in Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapRef.current) return;

      const map = L.map(mapRef.current, {
        center:          [center.lat, center.lng],
        zoom,
        zoomControl:     false,
        attributionControl: true,
      });

      mapObjRef.current = map;
      addTileLayer(L, map, "satellite");
      addMarkers(L, map, detections);
      setReady(true);
    });

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.remove();
        mapObjRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Swap tile layer when mode changes ── */
  useEffect(() => {
    const L   = leafletRef.current;
    const map = mapObjRef.current;
    if (!L || !map || !ready) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.eachLayer((layer: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((layer as any)._url) map.removeLayer(layer);
    });
    addTileLayer(L, map, layerMode);
  }, [layerMode, ready]);

  const handleZoomIn  = useCallback(() => { mapObjRef.current?.zoomIn(); }, []);
  const handleZoomOut = useCallback(() => { mapObjRef.current?.zoomOut(); }, []);
  const handleReset   = useCallback(() => { mapObjRef.current?.setView([center.lat, center.lng], zoom); }, [center.lat, center.lng, zoom]);


  return (
    <div className={`overflow-hidden rounded-xl border border-[#1D2D42] bg-[#0B131F] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] ${className}`}>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1D2D42] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Satellite Detection Map</h3>
          <p className="mt-0.5 text-xs text-slate-500">Real-time monitoring across all regions</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Layer toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLayerOpen((v) => !v)}
              aria-expanded={layerOpen}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                layerOpen
                  ? "border-[#00D284]/40 bg-[#00D284]/10 text-[#00D284]"
                  : "border-[#1D2D42] bg-[#16273B] text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              {LAYER_LABELS[layerMode]}
            </button>

            {layerOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-[#1D2D42] bg-[#101E2E] py-1 shadow-2xl">
                {(["satellite", "terrain", "standard"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setLayerMode(mode); setLayerOpen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/5 ${
                      layerMode === mode ? "text-[#00D284] font-semibold" : "text-slate-300"
                    }`}
                  >
                    {layerMode === mode && <span className="h-1.5 w-1.5 rounded-full bg-[#00D284]" />}
                    {LAYER_LABELS[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/map"
            className="flex items-center gap-1 text-xs text-cyan-400 transition-colors hover:text-white"
          >
            View Full Map <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Map container */}
      <div className="relative" style={{ height }}>

        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />

        {/* Ping animation injected globally once */}
        <style>{`
          @keyframes leaflet-ping {
            0%   { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(2.6); opacity: 0; }
          }
          .terratrace-popup .leaflet-popup-content-wrapper {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .terratrace-popup .leaflet-popup-tip-container { display: none; }
          .terratrace-popup .leaflet-popup-content { margin: 0 !important; }
          .leaflet-attribution-flag { display: none !important; }
        `}</style>

        {/* Loading shimmer */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0B131F] z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00D284] border-t-transparent" />
              <span className="text-xs text-slate-500">Loading satellite map…</span>
            </div>
          </div>
        )}

        {/* Leaflet mount point */}
        <div ref={mapRef} className="absolute inset-0 z-0" style={{ height: "100%" }} />

        {/* Zoom controls */}
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={handleZoomIn}
            className="map-control flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={handleZoomOut}
            className="map-control flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Reset"
            onClick={handleReset}
            className="map-control flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Compass className="h-4 w-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] rounded-lg border border-[#1D2D42] bg-[#0B131F]/90 px-3 py-2 text-[10px] text-slate-400 backdrop-blur-sm">
          <p className="mb-1.5 font-semibold uppercase tracking-wider text-slate-500">Detection Types</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {(Object.entries(PIN_COLOR) as [MapDetection["type"], string][]).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="capitalize">{type.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
