"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe2,
  ExternalLink,
  Compass,
  Crosshair,
  Pause,
  Play,
  Maximize2,
  Sparkles,
  MapPin,
  Eye,
  Layers,
  Flame,
  Trees,
  HardHat,
  Pickaxe,
  Check,
  ChevronDown,
  ChevronRight,
  Calendar,
  Info,
} from "lucide-react";
import type { DetectionItem, LocationItem, ScanItem } from "@/lib/api";
import { api } from "@/lib/api";
import type { FeatureCollection, Geometry, Point } from "geojson";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";

interface Photorealistic3DGlobeProps {
  locations?: LocationItem[];
  scans?: ScanItem[];
  className?: string;
  onSelectLocation?: (location: LocationItem) => void;
}

const GOOGLE_EARTH_WEB_URL =
  "https://earth.google.com/web/@22.13657139,84.104813,1847.51948258a,8882701.17153168d,35y,0h,0t,0r/data=CgRCAggBOgMKATBCAggASg0I____________ARAA?authuser=0";

// Coordinates requested by user: 22.13657139°N, 84.104813°E
const DEFAULT_CENTER: [number, number] = [84.104813, 22.13657139];

// Google Maps Satellite Embed URL (100% embeddable without 403 errors)
const GOOGLE_MAPS_SATELLITE_EMBED =
  "https://maps.google.com/maps?q=22.13657139,84.104813&t=k&z=15&ie=UTF8&iwloc=&output=embed";

export default function Photorealistic3DGlobe({
  locations = [],
  scans = [],
  className = "",
  onSelectLocation,
}: Photorealistic3DGlobeProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<MapboxMarker[]>([]);

  const [activeEngine, setActiveEngine] = useState<"mapbox-globe" | "google-earth">("mapbox-globe");
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("target");
  const animationFrameRef = useRef<number | null>(null);

  // Real change detection data loaded from backend
  const [allDetections, setAllDetections] = useState<DetectionItem[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Layer Toggles (with proper indentation hierarchy)
  const [layersOpen, setLayersOpen] = useState<boolean>(true);
  const [layerVisibility, setLayerVisibility] = useState({
    heatmap: true,
    construction: true,
    deforestation: true,
    mining: true,
  });

  // Calculate 1-year time interval dynamically
  const oneYearDates = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 1);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return {
      label: `${fmt(start)} – ${fmt(end)}`,
      startIso: start.toISOString().slice(0, 10),
      endIso: end.toISOString().slice(0, 10),
    };
  }, []);

  // Fetch real detections from all completed scans
  useEffect(() => {
    let active = true;
    async function loadRealData() {
      try {
        setLoadingData(true);
        const scanList = scans.length > 0 ? scans : await api.getScans();
        const completedScans = scanList.filter((s) => s.status === "completed" || s.detection_count > 0);

        const results = await Promise.all(
          completedScans.map((s) =>
            api.getAnalysisResults(s.id).catch(() => null)
          )
        );

        if (!active) return;
        const collected: DetectionItem[] = [];
        for (const res of results) {
          if (res && res.detections) {
            collected.push(...res.detections);
          }
        }
        setAllDetections(collected);
      } catch (err) {
        console.error("Failed to load real detections:", err);
      } finally {
        if (active) setLoadingData(false);
      }
    }

    loadRealData();
    return () => {
      active = false;
    };
  }, [scans]);

  // Aggregate metrics for real detections
  const metrics = useMemo(() => {
    const counts = { Deforestation: 0, Mining: 0, Construction: 0, Other: 0 };
    const areas = { Deforestation: 0, Mining: 0, Construction: 0, Other: 0 };

    for (const d of allDetections) {
      const type = (d.change_type in counts ? d.change_type : "Other") as keyof typeof counts;
      counts[type] += 1;
      areas[type] += d.area_hectares;
    }

    return { counts, areas, total: allDetections.length };
  }, [allDetections]);

  // GeoJSON FeatureCollections for Mapbox
  const { detectionGeoJson, centroidGeoJson } = useMemo(() => {
    const features: FeatureCollection<Geometry>["features"] = [];
    const centroids: FeatureCollection<Point>["features"] = [];

    allDetections.forEach((det) => {
      const poly = det.polygon as { type?: string; coordinates?: [number, number][][] } | undefined;
      const hasPoly = poly?.type === "Polygon" && Boolean(poly.coordinates?.[0]?.length);
      const geometry: Geometry = hasPoly
        ? (poly as Geometry)
        : ({ type: "Point", coordinates: [det.centroid_lon, det.centroid_lat] } satisfies Point);

      features.push({
        type: "Feature",
        id: det.id,
        geometry,
        properties: {
          id: det.id,
          changeType: det.change_type,
          confidence: det.confidence,
          areaHa: det.area_hectares,
        },
      });

      centroids.push({
        type: "Feature",
        id: `c-${det.id}`,
        geometry: { type: "Point", coordinates: [det.centroid_lon, det.centroid_lat] },
        properties: {
          id: det.id,
          changeType: det.change_type,
          confidence: det.confidence,
          areaHa: det.area_hectares,
          intensity: det.mean_intensity || 0.8,
        },
      });
    });

    return {
      detectionGeoJson: { type: "FeatureCollection" as const, features },
      centroidGeoJson: { type: "FeatureCollection" as const, features: centroids },
    };
  }, [allDetections]);

  // Initialize Mapbox 3D Globe once on mount
  useEffect(() => {
    if (!containerRef.current || !token) return;

    let disposed = false;
    let map: MapboxMap | null = null;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (disposed || !containerRef.current) return;
      mapboxgl.accessToken = token;

      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: DEFAULT_CENTER,
        zoom: 2.2,
        pitch: 42,
        bearing: -15,
        projection: "globe",
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (disposed || !map) return;
        setMapLoaded(true);

        // Realistic space atmosphere
        map.setFog({
          color: "rgb(6, 18, 30)",
          "high-color": "rgb(15, 35, 60)",
          "horizon-blend": 0.08,
          "space-color": "rgb(2, 6, 12)",
          "star-intensity": 0.85,
        });

        // 3D Terrain
        try {
          if (!map.getSource("mapbox-dem")) {
            map.addSource("mapbox-dem", {
              type: "raster-dem",
              url: "mapbox://mapbox.mapbox-terrain-dem-v1",
              tileSize: 512,
              maxzoom: 14,
            });
            map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
          }
        } catch {
          // Fallback
        }

        // ── 1. REAL GFW SATELLITE DEFORESTATION ALERTS (PAST 1 YEAR) ──
        map.addSource("gfw-forest-alerts", {
          type: "raster",
          tiles: [
            `https://tiles.globalforestwatch.org/umd_glad_landsat_alerts/latest/dynamic/{z}/{x}/{y}.png?start_date=${oneYearDates.startIso}&end_date=${oneYearDates.endIso}&confirmed_only=false`,
          ],
          tileSize: 256,
          attribution: "GLAD alerts · Global Forest Watch",
        });

        map.addLayer({
          id: "gfw-forest-alerts-layer",
          type: "raster",
          source: "gfw-forest-alerts",
          paint: {
            "raster-opacity": layerVisibility.deforestation ? 0.75 : 0,
          },
        });

        // ── 2. REAL DETECTIONS DATA SOURCE ──────────────────────────
        map.addSource("terratrace-detections", {
          type: "geojson",
          data: detectionGeoJson,
        });

        map.addSource("terratrace-centroids", {
          type: "geojson",
          data: centroidGeoJson,
        });

        // ── 3. REAL HEATMAP LAYER (1-YEAR CUMULATIVE CHANGE) ────────
        map.addLayer({
          id: "change-heatmap",
          type: "heatmap",
          source: "terratrace-centroids",
          maxzoom: 16,
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "confidence"], 0, 0.2, 100, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 12, 2.5],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0,0,0,0)",
              0.2, "#22d3ee",
              0.4, "#22c55e",
              0.7, "#f59e0b",
              1, "#ef4444",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 15, 12, 40],
            "heatmap-opacity": layerVisibility.heatmap ? 0.85 : 0,
          },
        });

        // ── 4. REAL CONSTRUCTION LAYER (ROSE/RED) ───────────────────
        map.addLayer({
          id: "construction-fill",
          type: "fill",
          source: "terratrace-detections",
          filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "changeType"], "Construction"]],
          paint: {
            "fill-color": "#ef4444",
            "fill-opacity": layerVisibility.construction ? 0.45 : 0,
          },
        });

        map.addLayer({
          id: "construction-line",
          type: "line",
          source: "terratrace-detections",
          filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "changeType"], "Construction"]],
          paint: {
            "line-color": "#ef4444",
            "line-width": 2.5,
            "line-opacity": layerVisibility.construction ? 0.9 : 0,
          },
        });

        map.addLayer({
          id: "construction-points",
          type: "circle",
          source: "terratrace-detections",
          filter: ["==", ["get", "changeType"], "Construction"],
          paint: {
            "circle-radius": 7,
            "circle-color": "#ef4444",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": layerVisibility.construction ? 0.95 : 0,
          },
        });

        // ── 5. REAL DEFORESTATION LAYER (EMERALD GREEN) ──────────────
        map.addLayer({
          id: "deforestation-fill",
          type: "fill",
          source: "terratrace-detections",
          filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "changeType"], "Deforestation"]],
          paint: {
            "fill-color": "#22c55e",
            "fill-opacity": layerVisibility.deforestation ? 0.45 : 0,
          },
        });

        map.addLayer({
          id: "deforestation-line",
          type: "line",
          source: "terratrace-detections",
          filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "changeType"], "Deforestation"]],
          paint: {
            "line-color": "#22c55e",
            "line-width": 2.5,
            "line-opacity": layerVisibility.deforestation ? 0.9 : 0,
          },
        });

        map.addLayer({
          id: "deforestation-points",
          type: "circle",
          source: "terratrace-detections",
          filter: ["==", ["get", "changeType"], "Deforestation"],
          paint: {
            "circle-radius": 7,
            "circle-color": "#22c55e",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": layerVisibility.deforestation ? 0.95 : 0,
          },
        });

        // ── 6. REAL MINING LAYER (AMBER) ────────────────────────────
        map.addLayer({
          id: "mining-fill",
          type: "fill",
          source: "terratrace-detections",
          filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "changeType"], "Mining"]],
          paint: {
            "fill-color": "#f59e0b",
            "fill-opacity": layerVisibility.mining ? 0.45 : 0,
          },
        });

        map.addLayer({
          id: "mining-line",
          type: "line",
          source: "terratrace-detections",
          filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "changeType"], "Mining"]],
          paint: {
            "line-color": "#f59e0b",
            "line-width": 2.5,
            "line-opacity": layerVisibility.mining ? 0.9 : 0,
          },
        });

        map.addLayer({
          id: "mining-points",
          type: "circle",
          source: "terratrace-detections",
          filter: ["==", ["get", "changeType"], "Mining"],
          paint: {
            "circle-radius": 7,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": layerVisibility.mining ? 0.95 : 0,
          },
        });

        // Interactive Click Inspection Popup
        const clickLayers = [
          "construction-fill", "construction-points",
          "deforestation-fill", "deforestation-points",
          "mining-fill", "mining-points",
        ];

        clickLayers.forEach((layerId) => {
          map?.on("click", layerId, (e) => {
            const feat = e.features?.[0];
            if (!feat || !map) return;
            const props = feat.properties as { changeType?: string; areaHa?: number; confidence?: number; id?: number };
            const typeColor =
              props.changeType === "Deforestation" ? "#22c55e" : props.changeType === "Mining" ? "#f59e0b" : "#ef4444";

            new mapboxgl.Popup({ offset: 16 })
              .setLngLat(e.lngLat)
              .setHTML(`
                <div class="font-mono text-xs p-1">
                  <div class="flex items-center gap-1.5 mb-1">
                    <span class="h-2 w-2 rounded-full" style="background:${typeColor}"></span>
                    <strong class="text-white font-bold">${props.changeType || "Environmental Change"}</strong>
                  </div>
                  <p class="text-slate-300 text-[11px]">Area: <strong class="text-white">${Number(props.areaHa || 0).toFixed(2)} ha</strong></p>
                  <p class="text-emerald-400 text-[11px] font-semibold">${Number(props.confidence || 0).toFixed(1)}% AI Confidence</p>
                  <span class="text-[10px] text-cyan-300 block mt-1">Verified multi-temporal anomaly</span>
                </div>
              `)
              .addTo(map);
          });

          map?.on("mouseenter", layerId, () => {
            if (map) map.getCanvas().style.cursor = "pointer";
          });
          map?.on("mouseleave", layerId, () => {
            if (map) map.getCanvas().style.cursor = "";
          });
        });

        // Add Target Pin at 22.13657139°N, 84.104813°E
        const targetEl = document.createElement("div");
        targetEl.className = "ge-target-pin";
        targetEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute h-8 w-8 rounded-full bg-cyan-400/40 animate-ping"></span>
            <span class="relative h-4 w-4 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_15px_#22D3EE]"></span>
          </div>
        `;

        const targetMarker = new mapboxgl.Marker({ element: targetEl })
          .setLngLat(DEFAULT_CENTER)
          .setPopup(
            new mapboxgl.Popup({ offset: 20 }).setHTML(`
              <div class="font-mono text-xs p-1">
                <strong class="text-cyan-400 block font-bold">Earth Observation Target</strong>
                <span class="text-slate-300 text-[10px]">22.13657°N, 84.10481°E</span>
                <p class="text-slate-400 text-[10px] mt-1">Primary satellite monitoring quadrant</p>
              </div>
            `)
          )
          .addTo(map);
        markersRef.current.push(targetMarker);

        // Add Database Locations Pins
        locations.forEach((loc) => {
          const locEl = document.createElement("div");
          locEl.className = "ge-loc-pin cursor-pointer";
          locEl.innerHTML = `
            <div class="relative flex items-center justify-center">
              <span class="absolute h-6 w-6 rounded-full bg-emerald-400/30 animate-pulse"></span>
              <span class="relative h-3 w-3 rounded-full bg-emerald-400 border border-white"></span>
            </div>
          `;

          const m = new mapboxgl.Marker({ element: locEl })
            .setLngLat([loc.longitude, loc.latitude])
            .setPopup(
              new mapboxgl.Popup({ offset: 16 }).setHTML(`
                <div class="font-mono text-xs p-1">
                  <strong class="text-emerald-300 block font-bold">${loc.name}</strong>
                  <span class="text-slate-300 text-[10px]">${loc.latitude.toFixed(4)}°N, ${loc.longitude.toFixed(4)}°E</span>
                  <p class="text-slate-400 text-[10px] mt-1">${loc.description || "Active monitoring perimeter"}</p>
                </div>
              `)
            )
            .addTo(map!);
          locEl.addEventListener("click", () => onSelectLocation?.(loc));
          markersRef.current.push(m);
        });
      });
    });

    return () => {
      disposed = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [token, locations, onSelectLocation, oneYearDates]);

  // Update dynamic GeoJSON data whenever allDetections changes
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      const srcA = mapRef.current.getSource("terratrace-detections") as import("mapbox-gl").GeoJSONSource;
      if (srcA) srcA.setData(detectionGeoJson);

      const srcB = mapRef.current.getSource("terratrace-centroids") as import("mapbox-gl").GeoJSONSource;
      if (srcB) srcB.setData(centroidGeoJson);
    }
  }, [detectionGeoJson, centroidGeoJson]);

  // Synchronize Layer Visibilities on the Mapbox 3D Globe
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const map = mapRef.current;

    // Heatmap
    if (map.getLayer("change-heatmap")) {
      map.setPaintProperty("change-heatmap", "heatmap-opacity", layerVisibility.heatmap ? 0.85 : 0);
    }

    // Deforestation (GFW raster + vectors)
    if (map.getLayer("gfw-forest-alerts-layer")) {
      map.setPaintProperty("gfw-forest-alerts-layer", "raster-opacity", layerVisibility.deforestation ? 0.75 : 0);
    }
    if (map.getLayer("deforestation-fill")) {
      map.setPaintProperty("deforestation-fill", "fill-opacity", layerVisibility.deforestation ? 0.45 : 0);
    }
    if (map.getLayer("deforestation-line")) {
      map.setPaintProperty("deforestation-line", "line-opacity", layerVisibility.deforestation ? 0.9 : 0);
    }
    if (map.getLayer("deforestation-points")) {
      map.setPaintProperty("deforestation-points", "circle-opacity", layerVisibility.deforestation ? 0.95 : 0);
    }

    // Construction
    if (map.getLayer("construction-fill")) {
      map.setPaintProperty("construction-fill", "fill-opacity", layerVisibility.construction ? 0.45 : 0);
    }
    if (map.getLayer("construction-line")) {
      map.setPaintProperty("construction-line", "line-opacity", layerVisibility.construction ? 0.9 : 0);
    }
    if (map.getLayer("construction-points")) {
      map.setPaintProperty("construction-points", "circle-opacity", layerVisibility.construction ? 0.95 : 0);
    }

    // Mining
    if (map.getLayer("mining-fill")) {
      map.setPaintProperty("mining-fill", "fill-opacity", layerVisibility.mining ? 0.45 : 0);
    }
    if (map.getLayer("mining-line")) {
      map.setPaintProperty("mining-line", "line-opacity", layerVisibility.mining ? 0.9 : 0);
    }
    if (map.getLayer("mining-points")) {
      map.setPaintProperty("mining-points", "circle-opacity", layerVisibility.mining ? 0.95 : 0);
    }
  }, [layerVisibility]);

  // Handle engine toggle resize
  useEffect(() => {
    if (activeEngine === "mapbox-globe" && mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.resize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeEngine]);

  // Smooth Globe auto-rotation
  useEffect(() => {
    if (!isRotating || !mapRef.current || !mapLoaded || activeEngine !== "mapbox-globe") {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const map = mapRef.current;
    let lastTime = performance.now();

    const spin = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      if (map && !map.isMoving()) {
        const center = map.getCenter();
        center.lng += delta * 0.0035;
        map.jumpTo({ center });
      }
      animationFrameRef.current = requestAnimationFrame(spin);
    };

    animationFrameRef.current = requestAnimationFrame(spin);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRotating, mapLoaded, activeEngine]);

  const flyToTarget = (lng: number, lat: number, zoom = 9, pitch = 45, presetKey = "custom") => {
    if (!mapRef.current) return;
    setIsRotating(false);
    setSelectedPreset(presetKey);
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom,
      pitch,
      essential: true,
      duration: 3500,
    });
  };

  return (
    <div
      className={`relative flex flex-col w-full rounded-2xl overflow-hidden border border-cyan-500/20 bg-[#040e18] shadow-[0_20px_60px_rgba(0,0,0,0.6)] ${className}`}
    >
      {/* ── TOP CONTROL OVERLAY BAR ──────────────────────────────── */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Engine Selector */}
        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#061522]/90 p-1.5 backdrop-blur-md pointer-events-auto shadow-lg">
          <button
            type="button"
            onClick={() => setActiveEngine("mapbox-globe")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-all ${
              activeEngine === "mapbox-globe"
                ? "bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe2 className="h-3.5 w-3.5 text-cyan-300" />
            <span>3D Satellite Globe</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveEngine("google-earth")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-all ${
              activeEngine === "google-earth"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-blue-300" />
            <span>Google Earth Satellite</span>
          </button>
        </div>

        {/* Right: Quick Launch in Google Earth Web & Rotation Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {activeEngine === "mapbox-globe" && (
            <button
              type="button"
              onClick={() => setIsRotating((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#061522]/90 px-3 py-1.5 text-xs font-mono backdrop-blur-md transition-all ${
                isRotating ? "text-cyan-300 border-cyan-400/40" : "text-slate-400 hover:text-white"
              }`}
            >
              {isRotating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isRotating ? "Pause Orbit" : "Auto Orbit"}</span>
            </button>
          )}

          <a
            href={GOOGLE_EARTH_WEB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-1.5 text-xs font-mono font-bold text-white shadow-[0_0_18px_rgba(6,182,212,0.4)] hover:brightness-110 transition-all"
          >
            <span>Open in Google Earth</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* ── PROPERLY INDENTED LAYER CONTROLS (LATEST 1 YEAR) ─────── */}
      <div className="absolute top-16 left-4 z-20 w-80 max-w-[calc(100vw-2rem)] font-mono text-xs pointer-events-auto">
        <div className="rounded-xl border border-white/10 bg-[#061522]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <button
            type="button"
            onClick={() => setLayersOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3 border-b border-white/[0.08] hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <div>
                <span className="font-bold text-white block text-xs">
                  Real Change Layers (1 Year)
                </span>
                <span className="text-[10px] text-cyan-300/80 font-normal">
                  {oneYearDates.label}
                </span>
              </div>
            </div>
            {layersOpen ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {/* Indented Layer Tree Structure */}
          {layersOpen && (
            <div className="p-3 space-y-2.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/[0.06] pb-1">
                ▼ Cumulative Environmental Changes
              </div>

              {/* 1. HEATMAP LAYER (INDENT LEVEL 1) */}
              <div className="pl-3 border-l-2 border-cyan-500/30 space-y-1">
                <label className="flex items-center justify-between cursor-pointer select-none group">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layerVisibility.heatmap}
                      onChange={(e) =>
                        setLayerVisibility((prev) => ({ ...prev, heatmap: e.target.checked }))
                      }
                      className="accent-cyan-400 rounded h-3.5 w-3.5 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 font-bold text-slate-200 group-hover:text-white">
                      <Flame className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Heatmap Density</span>
                    </div>
                  </div>
                  <span className="text-[10px] rounded bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 text-cyan-300 font-semibold">
                    Live
                  </span>
                </label>
                {/* Indent Level 2 Sub-Detail */}
                <div className="pl-6 text-[10px] text-slate-400 flex items-center gap-2">
                  <span className="text-slate-600">└──</span>
                  <span>Spatial change clustering & intensity gradient</span>
                </div>
              </div>

              {/* 2. DEFORESTATION LAYER (INDENT LEVEL 1) */}
              <div className="pl-3 border-l-2 border-emerald-500/30 space-y-1">
                <label className="flex items-center justify-between cursor-pointer select-none group">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layerVisibility.deforestation}
                      onChange={(e) =>
                        setLayerVisibility((prev) => ({ ...prev, deforestation: e.target.checked }))
                      }
                      className="accent-emerald-400 rounded h-3.5 w-3.5 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 font-bold text-slate-200 group-hover:text-white">
                      <Trees className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Deforestation</span>
                    </div>
                  </div>
                  <span className="text-[10px] rounded bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 text-emerald-300 font-semibold">
                    {metrics.counts.Deforestation} sites
                  </span>
                </label>
                {/* Indent Level 2 Sub-Detail */}
                <div className="pl-6 text-[10px] text-slate-400 flex items-center gap-2">
                  <span className="text-slate-600">├──</span>
                  <span>GFW GLAD Satellite Alerts (2025–2026)</span>
                </div>
                <div className="pl-6 text-[10px] text-slate-400 flex items-center gap-2">
                  <span className="text-slate-600">└──</span>
                  <span>Canopy Loss Vectors ({metrics.areas.Deforestation.toFixed(2)} ha)</span>
                </div>
              </div>

              {/* 3. MINING LAYER (INDENT LEVEL 1) */}
              <div className="pl-3 border-l-2 border-amber-500/30 space-y-1">
                <label className="flex items-center justify-between cursor-pointer select-none group">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layerVisibility.mining}
                      onChange={(e) =>
                        setLayerVisibility((prev) => ({ ...prev, mining: e.target.checked }))
                      }
                      className="accent-amber-400 rounded h-3.5 w-3.5 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 font-bold text-slate-200 group-hover:text-white">
                      <Pickaxe className="h-3.5 w-3.5 text-amber-400" />
                      <span>Mining Activity</span>
                    </div>
                  </div>
                  <span className="text-[10px] rounded bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 text-amber-300 font-semibold">
                    {metrics.counts.Mining} sites
                  </span>
                </label>
                {/* Indent Level 2 Sub-Detail */}
                <div className="pl-6 text-[10px] text-slate-400 flex items-center gap-2">
                  <span className="text-slate-600">├──</span>
                  <span>Open-Cast Excavation Pits & Terracing</span>
                </div>
                <div className="pl-6 text-[10px] text-slate-400 flex items-center gap-2">
                  <span className="text-slate-600">└──</span>
                  <span>Overpass Mapped Mine Registry ({metrics.areas.Mining.toFixed(2)} ha)</span>
                </div>
              </div>

              {/* 4. CONSTRUCTION LAYER (INDENT LEVEL 1) */}
              <div className="pl-3 border-l-2 border-rose-500/30 space-y-1">
                <label className="flex items-center justify-between cursor-pointer select-none group">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layerVisibility.construction}
                      onChange={(e) =>
                        setLayerVisibility((prev) => ({ ...prev, construction: e.target.checked }))
                      }
                      className="accent-rose-400 rounded h-3.5 w-3.5 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 font-bold text-slate-200 group-hover:text-white">
                      <HardHat className="h-3.5 w-3.5 text-rose-400" />
                      <span>Construction</span>
                    </div>
                  </div>
                  <span className="text-[10px] rounded bg-rose-950/60 border border-rose-800/40 px-1.5 py-0.5 text-rose-300 font-semibold">
                    {metrics.counts.Construction} sites
                  </span>
                </label>
                {/* Indent Level 2 Sub-Detail */}
                <div className="pl-6 text-[10px] text-slate-400 flex items-center gap-2">
                  <span className="text-slate-600">└──</span>
                  <span>Unpermitted Ground Clearing & Structural Pads ({metrics.areas.Construction.toFixed(2)} ha)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN 3D GLOBE / GOOGLE EARTH CANVAS ─────────────────── */}
      <div className="relative min-h-[520px] sm:min-h-[620px] w-full">
        {/* ENGINE 1: PHOTOREALISTIC 3D MAPBOX SATELLITE GLOBE */}
        <div
          className={`relative h-full min-h-[520px] sm:min-h-[620px] w-full ${
            activeEngine === "mapbox-globe" ? "block" : "hidden"
          }`}
        >
          <div ref={containerRef} className="h-full w-full min-h-[520px] sm:min-h-[620px]" />
          <div className="scanline-beam pointer-events-none" />

          {/* Target Coordinates Overlay Pill */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#06121c]/85 px-3.5 py-2 font-mono text-[11px] text-slate-300 backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Crosshair className="h-3.5 w-3.5" /> 22.13657°N, 84.10481°E
            </span>
            <span className="text-slate-500">•</span>
            <span>Real 3D Satellite Earth</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-semibold">
              {metrics.total} Real Changes Identified
            </span>
          </div>

          {/* Quick Fly-To Locations Sidebar Controls */}
          <div className="absolute right-4 top-18 z-20 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#061522]/90 p-2 font-mono text-xs backdrop-blur-md shadow-xl">
            <span className="text-[10px] text-slate-400 font-semibold uppercase px-1">Fly to Target:</span>
            <button
              type="button"
              onClick={() => flyToTarget(84.104813, 22.13657139, 10, 50, "target")}
              className={`text-left px-2.5 py-1 rounded-md text-[11px] transition-all ${
                selectedPreset === "target"
                  ? "bg-cyan-600/80 text-white font-bold"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              ★ Primary Target (22.14°N)
            </button>
            <button
              type="button"
              onClick={() => flyToTarget(88.85, 22.025, 11, 45, "sundarbans")}
              className={`text-left px-2.5 py-1 rounded-md text-[11px] transition-all ${
                selectedPreset === "sundarbans"
                  ? "bg-cyan-600/80 text-white font-bold"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              Sundarbans Biosphere
            </button>
            <button
              type="button"
              onClick={() => flyToTarget(87.1333, 23.6147, 12, 45, "raniganj")}
              className={`text-left px-2.5 py-1 rounded-md text-[11px] transition-all ${
                selectedPreset === "raniganj"
                  ? "bg-cyan-600/80 text-white font-bold"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              Raniganj Coal Basin
            </button>
            <button
              type="button"
              onClick={() => flyToTarget(-62.2159, -3.4653, 9, 35, "amazon")}
              className={`text-left px-2.5 py-1 rounded-md text-[11px] transition-all ${
                selectedPreset === "amazon"
                  ? "bg-cyan-600/80 text-white font-bold"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              Amazon Frontier
            </button>
            <button
              type="button"
              onClick={() => {
                flyToTarget(DEFAULT_CENTER[0], DEFAULT_CENTER[1], 2.2, 30, "orbit");
                setIsRotating(true);
              }}
              className="mt-1 text-left px-2.5 py-1 rounded-md text-[11px] text-cyan-300 border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/50"
            >
              Reset Global Orbit
            </button>
          </div>
        </div>

        {/* ENGINE 2: GOOGLE EARTH SATELLITE ENGINE */}
        <div
          className={`relative h-full min-h-[520px] sm:min-h-[620px] w-full flex flex-col bg-[#05111b] overflow-hidden ${
            activeEngine === "google-earth" ? "block" : "hidden"
          }`}
        >
          {/* Live Google Satellite Photorealistic Embed (100% embeddable without 403 errors) */}
          <iframe
            src={GOOGLE_MAPS_SATELLITE_EMBED}
            title="Google Earth Satellite Telemetry"
            className="h-full min-h-[520px] sm:min-h-[620px] w-full border-none filter contrast-105"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            loading="lazy"
          />

          {/* Overlay Banner & Direct Link to Google Earth 3D */}
          <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-400/30 bg-[#061522]/95 p-4 backdrop-blur-md font-mono text-xs shadow-2xl">
            <div>
              <strong className="text-white block font-display text-sm font-bold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                Google Earth 3D Telemetry · Real Satellite Imagery
              </strong>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Target: 22.13657139°N, 84.104813°E · High-resolution terrain & satellite photogrammetry
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveEngine("mapbox-globe")}
                className="rounded-lg border border-white/10 bg-[#081a2b] px-3.5 py-2 text-xs text-slate-300 hover:text-white transition-all"
              >
                Return to 3D Globe
              </button>
              <a
                href={GOOGLE_EARTH_WEB_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 font-bold text-white shadow-[0_0_18px_rgba(6,182,212,0.4)] hover:brightness-110 transition-all"
              >
                <span>Launch Google Earth 3D Web</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
