"use client";

import { useState } from "react";
import Link from "next/link";
import { Map, Globe2, Layers, ZoomIn, ZoomOut, Locate } from "lucide-react";
import { GlobeLive } from "@/components/globe-live";

// Dynamically import the globe component to avoid SSR issues
// Commented out until cobe package is installed
// const GlobeLive = dynamic(() => import("@/components/globe-live").then((mod) => ({ default: mod.GlobeLive })), {
//   ssr: false,
//   loading: () => (
//     <div className="flex items-center justify-center h-full">
//       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
//     </div>
//   )
// });

interface MapPanelProps {
  className?: string;
}

export default function MapPanel({ className = "" }: MapPanelProps) {
  const [viewMode, setViewMode] = useState<"map" | "globe">("map");
  const [mapZoom, setMapZoom] = useState(1);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layers, setLayers] = useState({
    deforestation: true,
    mining: true,
    construction: true,
    changeDetection: true,
    baseMap: true,
  });

  const toggleLayer = (layerKey: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const layerConfig = [
    { key: 'deforestation' as const, label: 'Deforestation', color: 'bg-green-500' },
    { key: 'mining' as const, label: 'Mining', color: 'bg-amber-500' },
    { key: 'construction' as const, label: 'Construction', color: 'bg-red-500' },
    { key: 'changeDetection' as const, label: 'Change Detection', color: 'bg-cyan-500' },
    { key: 'baseMap' as const, label: 'Base Map', color: 'bg-slate-500' },
  ];

  return (
    <div className={`glass-card rounded-2xl border border-white/6 bg-[#0C1C2C]/72 backdrop-blur-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/6">
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-cyan-400" />
          <h3 className="font-semibold text-white">Satellite Map</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              aria-pressed={viewMode === "map"}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "map" 
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-400/30" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Map className="h-3 w-3" />
              Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode("globe")}
              aria-pressed={viewMode === "globe"}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "globe" 
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-400/30" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe2 className="h-3 w-3" />
              Globe
            </button>
          </div>

          {/* Layers Button */}
          <button
            type="button"
            onClick={() => setLayersOpen(!layersOpen)}
            aria-expanded={layersOpen}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              layersOpen
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-400/30"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3 w-3" />
            Layers
          </button>
        </div>
      </div>

      {/* Map/Globe Content */}
      <div className="relative h-96">
        {viewMode === "map" ? (
          // Map View - Placeholder for now
          <div className="h-full bg-gradient-to-br from-green-900/20 to-blue-900/20 flex items-center justify-center relative overflow-hidden">
            {/* Simulated satellite imagery background */}
            <div className="absolute inset-0 opacity-30 transition-transform duration-300" style={{ transform: `scale(${mapZoom})` }}>
              <div className="w-full h-full bg-gradient-to-br from-green-800 via-yellow-900 to-brown-800" 
                   style={{
                     backgroundImage: `
                       radial-gradient(circle at 20% 30%, rgba(34, 197, 94, 0.3) 0%, transparent 50%),
                       radial-gradient(circle at 70% 60%, rgba(245, 101, 101, 0.3) 0%, transparent 50%),
                       radial-gradient(circle at 40% 80%, rgba(251, 191, 36, 0.3) 0%, transparent 50%)
                     `
                   }}>
              </div>
            </div>
            
            {/* Overlay content */}
            <div className="relative z-10 text-center">
              <div className="text-slate-300 text-sm font-mono mb-2">
                Sample map preview
              </div>
              <div className="text-xs text-slate-500">
                Preview scale {mapZoom.toFixed(1)}× · detailed view available on the map page
              </div>
              <Link href="/map" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-400/30 px-3 text-xs text-cyan-200 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                Open full map
              </Link>
            </div>

            {/* Map controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button type="button" aria-label="Zoom in" title="Zoom in" disabled={mapZoom >= 2.5} onClick={() => setMapZoom((zoom) => Math.min(2.5, Number((zoom + 0.25).toFixed(2))))} className="map-control flex h-11 w-11 items-center justify-center rounded-lg text-white disabled:cursor-not-allowed disabled:opacity-40">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Zoom out" title="Zoom out" disabled={mapZoom <= 1} onClick={() => setMapZoom((zoom) => Math.max(1, Number((zoom - 0.25).toFixed(2))))} className="map-control flex h-11 w-11 items-center justify-center rounded-lg text-white disabled:cursor-not-allowed disabled:opacity-40">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Reset map view" title="Reset map view" onClick={() => setMapZoom(1)} className="map-control flex h-11 w-11 items-center justify-center rounded-lg text-white">
                <Locate className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center overflow-hidden">
            <div className="w-full max-w-[320px]">
              <GlobeLive speed={0.0018} />
            </div>
          </div>
        )}

        {/* Layers Panel Overlay */}
        {layersOpen && (
          <div className="absolute top-4 left-4 w-64 bg-[#0C1C2C]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span className="font-medium text-white text-sm">Map Layers</span>
            </div>
            
            <div className="space-y-2">
              {layerConfig.map((layer) => (
                <label key={layer.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers[layer.key]}
                    onChange={() => toggleLayer(layer.key)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    layers[layer.key] 
                      ? 'bg-cyan-500/20 border-cyan-400' 
                      : 'border-slate-600'
                  }`}>
                    {layers[layer.key] && <div className="w-2 h-2 rounded bg-cyan-400" />}
                  </div>
                  <div className={`w-3 h-3 rounded ${layer.color}`} />
                  <span className="text-sm text-slate-300">{layer.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Time Range & Scale Bar */}
      <div className="flex items-center justify-between p-4 border-t border-white/6">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Last 12 Months</span>
          <span>•</span>
          <span>Scale: 1:50,000</span>
        </div>
        
        <button
          type="button"
          onClick={() => setViewMode((mode) => mode === "map" ? "globe" : "map")}
          aria-pressed={viewMode === "globe"}
          aria-label={`Switch to ${viewMode === "map" ? "globe" : "map"} view`}
          className="min-h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          Switch to {viewMode === "map" ? "globe" : "map"}
        </button>
      </div>
    </div>
  );
}