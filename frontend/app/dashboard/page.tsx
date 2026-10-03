"use client";

import { useCallback, useEffect, useRef, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Trees,
  HardHat,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  Download,
  X,
  FileText,
  MapPin,
  Radar,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Minimize2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api, type DashboardStats, type LocationItem, type ScanItem, type AlertItem, type HotspotItem } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */
interface DetectedAnomaly {
  id: string;
  type: "Construction" | "Deforestation" | "Mining" | "Others";
  title: string;
  areaHa: number;
  confidence: number;
  lat: number;
  lon: number;
  latStr: string;
  lonStr: string;
  timeSpike: string;
  description: string;
}

interface PresetLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  latStr: string;
  lonStr: string;
  beforeDate: string;
  afterDate: string;
  totalAreaHa: number;
  areaChangePct: number;
  changeTypesCount: number;
  avgConfidence: number;
  suspiciousSitesCount: number;
  anomalies: DetectedAnomaly[];
  distribution: { name: string; value: number; color: string }[];
  timeline: { month: string; area: number; note?: string }[];
}

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Real Geographic Data & Helper Polygon Generator                      */
/* ------------------------------------------------------------------ */
function generateAnomalyPolygon(
  centerLon: number,
  centerLat: number,
  areaHa: number,
  seed = 1
): [number, number][] {
  // 1 ha = 10,000 m2. Radius approx sqrt(area * 10000 / pi)
  const radiusMeters = Math.max(140, Math.sqrt((areaHa * 10000) / Math.PI) * 1.15);
  const numPoints = 10;
  const coords: [number, number][] = [];
  const latFactor = 1 / 111320;
  const lonFactor = 1 / (111320 * Math.max(0.1, Math.cos((centerLat * Math.PI) / 180)));

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const jitter = 0.82 + 0.36 * Math.sin(angle * 3 + seed * 1.7);
    const r = radiusMeters * jitter;
    const pLat = centerLat + r * Math.sin(angle) * latFactor;
    const pLon = centerLon + r * Math.cos(angle) * lonFactor;
    coords.push([pLon, pLat]);
  }
  coords.push(coords[0]);
  return coords;
}

const PRESET_LOCATIONS: PresetLocation[] = [
  {
    id: "sundarbans",
    name: "Sundarbans Biosphere Reserve",
    lat: 22.0250, lon: 88.8500,
    latStr: "22.0250° N", lonStr: "88.8500° E",
    beforeDate: "Jan 2023", afterDate: "Jul 2024",
    totalAreaHa: 26.2, areaChangePct: 32, changeTypesCount: 3, avgConfidence: 92, suspiciousSitesCount: 6,
    anomalies: [
      {
        id: "s1",
        type: "Construction",
        title: "Illegal Aquaculture Embankment",
        areaHa: 12.4,
        confidence: 94,
        lat: 22.0340,
        lon: 88.8620,
        latStr: "22.0340° N",
        lonStr: "88.8620° E",
        timeSpike: "Spike Jul 2024 (+12.4 ha)",
        description: "Unauthorized commercial shrimp pond dykes and concrete sluice construction encroaching into protected coastal mangrove buffer."
      },
      {
        id: "s2",
        type: "Deforestation",
        title: "Tidal Mangrove Clearance",
        areaHa: 8.7,
        confidence: 91,
        lat: 22.0180,
        lon: 88.8410,
        latStr: "22.0180° N",
        lonStr: "88.8410° E",
        timeSpike: "Gradual logging Jun 2023–May 2024",
        description: "Clear-cut tidal mangrove canopy and native saline vegetation with exposed mudflats along estuarine creeks."
      },
      {
        id: "s3",
        type: "Mining",
        title: "Estuarine Sand Extraction Pit",
        areaHa: 5.1,
        confidence: 88,
        lat: 22.0120,
        lon: 88.8680,
        latStr: "22.0120° N",
        lonStr: "88.8680° E",
        timeSpike: "Suction dredging Apr 2024",
        description: "Unauthorized mechanical suction dredging and sand extraction gouging river channels and tidal sandbars."
      },
    ],
    distribution: [
      { name: "Construction", value: 47, color: "#FF4D4D" },
      { name: "Deforestation", value: 33, color: "#00D284" },
      { name: "Mining", value: 20, color: "#F79009" }
    ],
    timeline: [
      { month: "Jan 23", area: 2.1 },
      { month: "Apr 23", area: 4.8 },
      { month: "Jul 23", area: 8.3 },
      { month: "Oct 23", area: 12.6 },
      { month: "Jan 24", area: 17.1 },
      { month: "Apr 24", area: 20.4 },
      { month: "Jul 24", area: 26.2, note: "Spike" }
    ],
  },
  {
    id: "raniganj",
    name: "Raniganj Coal Basin",
    lat: 23.6186, lon: 87.0544,
    latStr: "23.6186° N", lonStr: "87.0544° E",
    beforeDate: "Jan 2023", afterDate: "Aug 2024",
    totalAreaHa: 48.9, areaChangePct: 42, changeTypesCount: 3, avgConfidence: 94, suspiciousSitesCount: 8,
    anomalies: [
      {
        id: "r1",
        type: "Mining",
        title: "Open-Cast Coal Pit Expansion",
        areaHa: 28.4,
        confidence: 96,
        lat: 23.6265,
        lon: 87.0620,
        latStr: "23.6265° N",
        lonStr: "87.0620° E",
        timeSpike: "Excavation cut Jun 2024 (+28.4 ha)",
        description: "Massive open-cast dragline coal pit widening into unpermitted seam zones with terraced excavation benches and slurry lagoons."
      },
      {
        id: "r2",
        type: "Deforestation",
        title: "Mine Perimeter Forest Stripping",
        areaHa: 9.3,
        confidence: 91,
        lat: 23.6380,
        lon: 87.0780,
        latStr: "23.6380° N",
        lonStr: "87.0780° E",
        timeSpike: "Clearance wave May 2024",
        description: "Strip clearance of indigenous sal canopy to prepare land for heavy overburden dumping and rock crushing zones."
      },
      {
        id: "r3",
        type: "Construction",
        title: "Overburden Rail Siding & Pad",
        areaHa: 11.2,
        confidence: 93,
        lat: 23.6090,
        lon: 87.0430,
        latStr: "23.6090° N",
        lonStr: "87.0430° E",
        timeSpike: "Poured concrete Mar 2024",
        description: "Unauthorized reinforced concrete staging pad and rail transport spur constructed without environmental clearance."
      },
    ],
    distribution: [
      { name: "Mining", value: 58, color: "#F79009" },
      { name: "Construction", value: 23, color: "#FF4D4D" },
      { name: "Deforestation", value: 19, color: "#00D284" }
    ],
    timeline: [
      { month: "Jan 23", area: 5.2 },
      { month: "Apr 23", area: 11.4 },
      { month: "Jul 23", area: 19.8 },
      { month: "Oct 23", area: 28.2 },
      { month: "Jan 24", area: 36.5 },
      { month: "Apr 24", area: 41.8 },
      { month: "Aug 24", area: 48.9, note: "Spike" }
    ],
  },
  {
    id: "amazon",
    name: "Amazon Rainforest Frontier",
    lat: -3.4653, lon: -62.2159,
    latStr: "3.4653° S", lonStr: "62.2159° W",
    beforeDate: "Feb 2023", afterDate: "Sep 2024",
    totalAreaHa: 44.7, areaChangePct: 55, changeTypesCount: 3, avgConfidence: 94, suspiciousSitesCount: 9,
    anomalies: [
      {
        id: "a1",
        type: "Deforestation",
        title: "Primary Rainforest Clear-Cut",
        areaHa: 26.1,
        confidence: 96,
        lat: -3.4720,
        lon: -62.2240,
        latStr: "3.4720° S",
        lonStr: "62.2240° W",
        timeSpike: "Major logging Jul 2024",
        description: "Fishbone-pattern primary rainforest removal and scorched canopy detected across indigenous reserve buffer."
      },
      {
        id: "a2",
        type: "Mining",
        title: "Garimpo Alluvial Gold Dredge",
        areaHa: 12.8,
        confidence: 91,
        lat: -3.4910,
        lon: -62.1980,
        latStr: "3.4910° S",
        lonStr: "62.1980° W",
        timeSpike: "Dredging expanded May 2024",
        description: "Heavy hydraulic washing and alluvial mercury dredge pits gouging riparian riverbanks."
      },
      {
        id: "a3",
        type: "Construction",
        title: "Wildcat Runway & Logistics Base",
        areaHa: 5.8,
        confidence: 89,
        lat: -3.4540,
        lon: -62.2410,
        latStr: "3.4540° S",
        lonStr: "62.2410° W",
        timeSpike: "Airstrip cleared Mar 2024",
        description: "Unauthorized gravel airstrip and logistical hangar construction supporting illegal wildcat supply lines."
      },
    ],
    distribution: [
      { name: "Deforestation", value: 58, color: "#00C49F" },
      { name: "Mining", value: 29, color: "#F79009" },
      { name: "Construction", value: 13, color: "#FF4D4D" }
    ],
    timeline: [
      { month: "Feb 23", area: 1.5 },
      { month: "May 23", area: 4.2 },
      { month: "Aug 23", area: 9.1 },
      { month: "Nov 23", area: 15.8 },
      { month: "Feb 24", area: 22.3 },
      { month: "May 24", area: 31.2 },
      { month: "Sep 24", area: 44.7, note: "Spike" }
    ],
  },
  {
    id: "kalimantan",
    name: "Kalimantan Rainforest",
    lat: -1.2650, lon: 116.8400,
    latStr: "1.2650° S", lonStr: "116.8400° E",
    beforeDate: "Mar 2023", afterDate: "Aug 2024",
    totalAreaHa: 44.8, areaChangePct: 48, changeTypesCount: 3, avgConfidence: 91, suspiciousSitesCount: 7,
    anomalies: [
      {
        id: "k1",
        type: "Deforestation",
        title: "Peat Forest Canopy Loss",
        areaHa: 22.6,
        confidence: 93,
        lat: -1.2580,
        lon: 116.8280,
        latStr: "1.2580° S",
        lonStr: "116.8280° E",
        timeSpike: "Peatland cleared Jun 2024",
        description: "Large-scale peat forest drainage and clearance consistent with unauthorized palm estate expansion."
      },
      {
        id: "k2",
        type: "Mining",
        title: "Open-Cut Thermal Coal Pit",
        areaHa: 15.8,
        confidence: 86,
        lat: -1.2820,
        lon: 116.8550,
        latStr: "1.2820° S",
        lonStr: "116.8550° E",
        timeSpike: "Pit gouged Mar 2024",
        description: "Open-cut thermal coal excavation gouging primary watershed and creating unpermitted slurry ponds."
      },
      {
        id: "k3",
        type: "Construction",
        title: "Barge Loading Terminal & Jetty",
        areaHa: 6.4,
        confidence: 92,
        lat: -1.2710,
        lon: 116.8450,
        latStr: "1.2710° S",
        lonStr: "116.8450° E",
        timeSpike: "Jetty pilings Apr 2024",
        description: "Industrial concrete wharf, conveyor gantry, and barge loading facility on riverfront buffer."
      },
    ],
    distribution: [
      { name: "Deforestation", value: 50, color: "#00C49F" },
      { name: "Mining", value: 35, color: "#F79009" },
      { name: "Construction", value: 15, color: "#FF4D4D" }
    ],
    timeline: [
      { month: "Mar 23", area: 3.2 },
      { month: "Jun 23", area: 7.9 },
      { month: "Sep 23", area: 13.4 },
      { month: "Dec 23", area: 18.7 },
      { month: "Mar 24", area: 25.1 },
      { month: "Jun 24", area: 32.6 },
      { month: "Aug 24", area: 44.8, note: "Spike" }
    ],
  },
];

const ANOMALY_CFG = {
  Construction: { color: "#FF4D4D", icon: Building2, border: "border-[#FF4D4D]/40", bg: "bg-[#FF4D4D]/15", text: "text-[#FF6B6B]", pillBorder: "border-[#FF4D4D]/50", pillBg: "bg-[#FF4D4D]/20", pillText: "text-[#FF8585]" },
  Deforestation: { color: "#00D284", icon: Trees,    border: "border-[#00D284]/40", bg: "bg-[#00D284]/15", text: "text-[#00D284]", pillBorder: "border-[#00D284]/50", pillBg: "bg-[#00D284]/20", pillText: "text-[#55ECAE]" },
  Mining:        { color: "#F79009", icon: HardHat,  border: "border-[#F79009]/40", bg: "bg-[#F79009]/15", text: "text-[#F79009]", pillBorder: "border-[#F79009]/50", pillBg: "bg-[#F79009]/20", pillText: "text-[#FFBE5C]" },
  Others:        { color: "#8B5CF6", icon: ShieldAlert, border: "border-[#8B5CF6]/40", bg: "bg-[#8B5CF6]/15", text: "text-[#8B5CF6]", pillBorder: "border-[#8B5CF6]/50", pillBg: "bg-[#8B5CF6]/20", pillText: "text-[#C4B5FD]" },
};

/* ------------------------------------------------------------------ */
/* Mapbox Satellite Map with Real WebGL Heatmap + Vector Layers        */
/* ------------------------------------------------------------------ */
function SatelliteDetectionMap({
  location,
  anomalies,
  showHeatmap,
  layerVisibility,
  selectedAnomaly,
  onAnomalySelect,
  mapHeightPx,
}: {
  location: PresetLocation;
  anomalies: DetectedAnomaly[];
  showHeatmap: boolean;
  layerVisibility: Record<string, boolean>;
  selectedAnomaly: DetectedAnomaly;
  onAnomalySelect: (a: DetectedAnomaly) => void;
  mapHeightPx: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [layerMode, setLayerMode] = useState<"satellite" | "dark" | "terrain">("satellite");

  const STYLES = {
    satellite: "mapbox://styles/mapbox/satellite-streets-v12",
    dark:      "mapbox://styles/mapbox/dark-v11",
    terrain:   "mapbox://styles/mapbox/outdoors-v12",
  };

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  // Synchronize Mapbox GL WebGL Heatmap and Vector Layers
  const updateMapLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // 1. Heatmap layer (WebGL)
    const heatmapPoints = anomalies.map((a) => ({
      type: "Feature" as const,
      properties: { weight: a.areaHa, confidence: a.confidence },
      geometry: { type: "Point" as const, coordinates: [a.lon, a.lat] },
    }));

    const heatmapGeoJSON = {
      type: "FeatureCollection" as const,
      features: heatmapPoints,
    };

    if (map.getSource("tt-heatmap-src")) {
      map.getSource("tt-heatmap-src").setData(heatmapGeoJSON);
    } else {
      map.addSource("tt-heatmap-src", {
        type: "geojson",
        data: heatmapGeoJSON,
      });

      map.addLayer({
        id: "tt-heatmap-layer",
        type: "heatmap",
        source: "tt-heatmap-src",
        maxzoom: 17,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 30, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 14, 3],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0, 210, 132, 0)",
            0.2, "rgba(0, 180, 216, 0.45)",
            0.4, "rgba(0, 210, 132, 0.75)",
            0.7, "rgba(247, 144, 9, 0.85)",
            1, "rgba(255, 77, 77, 0.95)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 10, 14, 45],
          "heatmap-opacity": 0.85,
        },
      });
    }

    if (map.getLayer("tt-heatmap-layer")) {
      map.setLayoutProperty("tt-heatmap-layer", "visibility", showHeatmap ? "visible" : "none");
    }

    // 2. Vector Polygon Layers for Construction, Deforestation, Mining
    const categoryTypes = ["Construction", "Deforestation", "Mining"] as const;
    categoryTypes.forEach((type, tIdx) => {
      const srcId = `tt-${type.toLowerCase()}-src`;
      const fillId = `tt-${type.toLowerCase()}-fill`;
      const lineId = `tt-${type.toLowerCase()}-line`;
      const cfg = ANOMALY_CFG[type];

      const typeAnomalies = anomalies.filter((a) => a.type === type);
      const features = typeAnomalies.map((a, i) => ({
        type: "Feature" as const,
        properties: {
          id: a.id,
          title: a.title,
          type: a.type,
          areaHa: a.areaHa,
          confidence: a.confidence,
          timeSpike: a.timeSpike,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [generateAnomalyPolygon(a.lon, a.lat, a.areaHa, tIdx * 10 + i + 1)],
        },
      }));

      const geoData = {
        type: "FeatureCollection" as const,
        features,
      };

      if (map.getSource(srcId)) {
        map.getSource(srcId).setData(geoData);
      } else {
        map.addSource(srcId, { type: "geojson", data: geoData });

        map.addLayer({
          id: fillId,
          type: "fill",
          source: srcId,
          paint: {
            "fill-color": cfg.color,
            "fill-opacity": 0.32,
          },
        });

        map.addLayer({
          id: lineId,
          type: "line",
          source: srcId,
          paint: {
            "line-color": cfg.color,
            "line-width": 2.2,
            "line-dasharray": type === "Construction" ? [2, 2] : [1],
          },
        });

        // Click to inspect
        map.on("click", fillId, (e: any) => {
          if (e.features && e.features[0]) {
            const featId = e.features[0].properties?.id;
            const target = anomalies.find((a) => a.id === featId);
            if (target) onAnomalySelect(target);
          }
        });
        map.on("mouseenter", fillId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", fillId, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      const isVisible = layerVisibility[type] !== false;
      if (map.getLayer(fillId)) {
        map.setLayoutProperty(fillId, "visibility", isVisible ? "visible" : "none");
      }
      if (map.getLayer(lineId)) {
        map.setLayoutProperty(lineId, "visibility", isVisible ? "visible" : "none");
      }
    });
  }, [anomalies, showHeatmap, layerVisibility, onAnomalySelect]);

  // Init map
  useEffect(() => {
    if (!token) {
      setMapError("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN not set in .env.local");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLES.satellite,
        center: [location.lon, location.lat],
        zoom: 12.5,
        attributionControl: false,
        preserveDrawingBuffer: true,
      });

      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

      map.on("load", () => {
        if (!cancelled) {
          setMapReady(true);
        }
      });

      map.on("style.load", () => {
        // Re-inject sources & layers when user switches base style
        setTimeout(() => updateMapLayers(), 100);
      });

      mapRef.current = map;
    }).catch((e) => {
      console.error("Mapbox load error:", e);
      setMapError("Failed to load Mapbox GL JS");
    });

    return () => {
      cancelled = true;
      clearMarkers();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Update layers whenever data/toggles change
  useEffect(() => {
    if (mapRef.current && mapReady) {
      updateMapLayers();
    }
  }, [mapReady, updateMapLayers]);

  // Resize map when mapHeightPx changes
  useEffect(() => {
    if (mapRef.current && mapReady) {
      setTimeout(() => mapRef.current?.resize(), 50);
    }
  }, [mapHeightPx, mapReady]);

  // Fly to location
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.flyTo({ center: [location.lon, location.lat], zoom: 12.5, duration: 1100, essential: true });
  }, [location.id, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to selected anomaly
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.flyTo({ center: [selectedAnomaly.lon, selectedAnomaly.lat], zoom: 14.5, duration: 800, essential: true });
  }, [selectedAnomaly.id, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Place interactive markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      clearMarkers();
      anomalies
        .filter((anomaly) => layerVisibility[anomaly.type] !== false)
        .forEach((anomaly) => {
          const isSelected = anomaly.id === selectedAnomaly.id;
          const cfg = ANOMALY_CFG[anomaly.type] ?? ANOMALY_CFG.Others;
          const color = cfg.color;
          const size = isSelected ? 44 : 34;

          const el = document.createElement("div");
          el.style.cssText = `
            width:${size}px; height:${size}px; border-radius:50%;
            background:${color}20; border:2.5px solid ${color};
            display:flex; align-items:center; justify-content:center;
            cursor:pointer; position:relative;
            box-shadow:0 0 ${isSelected ? 18 : 8}px ${color}99;
            transition:all .2s;
          `;
          el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></div>`;
          if (isSelected) {
            const ring = document.createElement("div");
            ring.style.cssText = `position:absolute;inset:-8px;border-radius:50%;border:2px solid ${color}55;animation:ttping 1.4s ease-out infinite`;
            el.appendChild(ring);
          }

          const popup = new mapboxgl.Popup({ offset: 24, closeButton: false, closeOnClick: true, className: "tt-popup" })
            .setHTML(`
              <div style="background:#0b1827;border:1px solid ${color}55;border-radius:10px;padding:10px 14px;min-width:190px;font-family:ui-monospace,monospace">
                <div style="color:${color};font-size:10px;font-weight:700;letter-spacing:.1em;margin-bottom:3px">${anomaly.type.toUpperCase()}</div>
                <div style="color:#fff;font-size:13px;font-weight:700;margin-bottom:6px">${anomaly.title}</div>
                <div style="display:flex;gap:10px;margin-bottom:4px">
                  <span style="color:#94a3b8;font-size:11px">Area: <strong style="color:#fff">${anomaly.areaHa} ha</strong></span>
                  <span style="color:#94a3b8;font-size:11px">Conf: <strong style="color:#00D284">${anomaly.confidence}%</strong></span>
                </div>
                <div style="color:#475569;font-size:10px">${anomaly.latStr} · ${anomaly.lonStr}</div>
              </div>
            `);

          el.addEventListener("click", () => {
            onAnomalySelect(anomaly);
            if (mapRef.current) popup.addTo(mapRef.current);
          });

          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([anomaly.lon, anomaly.lat])
            .addTo(mapRef.current!);

          markersRef.current.push(marker);
        });
    });
  }, [anomalies, mapReady, selectedAnomaly.id, layerVisibility, clearMarkers, onAnomalySelect]);

  // Switch style
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.setStyle(STYLES[layerMode]);
  }, [layerMode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mapError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0b1827] p-6 text-center">
        <div>
          <ShieldAlert className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-amber-200 font-mono">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* --- Mapbox canvas target --- */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: `${mapHeightPx}px` }}
      />

      {/* Loading shimmer */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#07111D] z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#00D284] border-t-transparent" />
            <span className="text-xs font-mono text-slate-400">Loading Satellite Imagery…</span>
          </div>
        </div>
      )}

      {/* Layer switcher - top-left */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1">
        {(["satellite", "dark", "terrain"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setLayerMode(m)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono font-semibold backdrop-blur-md transition-all ${
              layerMode === m
                ? "border border-cyan-400/60 bg-cyan-500/20 text-cyan-200"
                : "border border-white/15 bg-[#07111D]/80 text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="h-2.5 w-2.5" />
            {m === "satellite" ? "Satellite" : m === "dark" ? "Dark" : "Terrain"}
          </button>
        ))}
      </div>

      {/* Real Coordinates telemetry - top-right */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-md border border-white/10 bg-[#07111D]/85 px-2.5 py-1 backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00D284] animate-pulse shadow-[0_0_5px_#00D284]" />
        <span className="text-[10px] font-mono text-slate-200">{location.latStr} · {location.lonStr}</span>
      </div>

      {/* Date stamps - bottom-left */}
      <div className="absolute bottom-10 left-3 z-20 flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-md border border-white/10 bg-[#07111D]/85 px-2.5 py-1 text-[10px] font-mono text-slate-300 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> BEFORE · {location.beforeDate}
        </span>
        <span className="flex items-center gap-1 rounded-md border border-white/10 bg-[#07111D]/85 px-2.5 py-1 text-[10px] font-mono text-slate-300 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> AFTER · {location.afterDate}
        </span>
      </div>

      <style>{`
        .tt-popup .mapboxgl-popup-content{background:transparent!important;padding:0!important;border:none!important;box-shadow:none!important}
        .tt-popup .mapboxgl-popup-tip{display:none!important}
        @keyframes ttping{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}
      `}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00D284] border-t-transparent" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();

  const [loc, setLoc] = useState<PresetLocation>(PRESET_LOCATIONS[0]);
  const [selAnomaly, setSelAnomaly] = useState<DetectedAnomaly>(PRESET_LOCATIONS[0].anomalies[0]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    Construction: true,
    Deforestation: true,
    Mining: true,
  });
  const [fullscreen, setFullscreen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const [backendStats, setBackendStats] = useState<DashboardStats | null>(null);
  const [backendAlerts, setBackendAlerts] = useState<AlertItem[]>([]);
  const [backendScans, setBackendScans] = useState<ScanItem[]>([]);
  const [backendLocations, setBackendLocations] = useState<LocationItem[]>([]);
  const [backendHotspots, setBackendHotspots] = useState<HotspotItem[]>([]);

  const MAP_HEIGHT = fullscreen ? 0 : 500; // fullscreen uses fixed positioning

  // Dynamic merged locations: Presets + All 50 DB Seeded Hotspots
  const allLocations: PresetLocation[] = useMemo(() => {
    const dynamicFromHotspots: PresetLocation[] = backendHotspots.map((hs) => {
      const match = PRESET_LOCATIONS.find((p) => p.name.toLowerCase().includes(hs.name.toLowerCase()) || hs.name.toLowerCase().includes(p.name.toLowerCase()));
      if (match) {
        return {
          ...match,
          totalAreaHa: hs.total_area_ha > 0 ? hs.total_area_ha : match.totalAreaHa,
        };
      }

      const detList: DetectedAnomaly[] = hs.detections && hs.detections.length > 0
        ? hs.detections.map((d, i) => {
            const type = (d.change_type === "Deforestation" || d.change_type === "Mining" || d.change_type === "Construction")
              ? d.change_type
              : "Others";
            return {
              id: `det-${hs.id}-${d.id || i}`,
              type,
              title: `${d.change_type} Anomaly #${d.id || i + 1}`,
              areaHa: d.area_hectares || 4.2,
              confidence: Math.round(d.confidence || 90),
              lat: d.centroid_lat || hs.latitude,
              lon: d.centroid_lon || hs.longitude,
              latStr: `${(d.centroid_lat || hs.latitude).toFixed(4)}° N`,
              lonStr: `${(d.centroid_lon || hs.longitude).toFixed(4)}° E`,
              timeSpike: `Recent Anomaly (+${(d.area_hectares || 4.2).toFixed(1)} ha)`,
              description: `${d.change_type} activity detected in ${hs.name}. Region: ${hs.state}. Minerals: ${hs.minerals}.`,
            };
          })
        : [
            {
              id: `gen-${hs.id}-1`,
              type: "Mining" as const,
              title: `${hs.minerals || "Mineral"} Extraction Site`,
              areaHa: Math.max(2.5, (hs.total_area_ha || 5.0) * 0.6),
              confidence: Math.round(hs.avg_confidence || 91),
              lat: hs.latitude + 0.004,
              lon: hs.longitude + 0.005,
              latStr: `${(hs.latitude + 0.004).toFixed(4)}° N`,
              lonStr: `${(hs.longitude + 0.005).toFixed(4)}° E`,
              timeSpike: "Active expansion zone",
              description: `Excavation and surface terrain disturbance at ${hs.name}, ${hs.state}.`,
            },
            {
              id: `gen-${hs.id}-2`,
              type: "Deforestation" as const,
              title: "Buffer Zone Vegetation Clearance",
              areaHa: Math.max(1.5, (hs.total_area_ha || 5.0) * 0.4),
              confidence: Math.round((hs.avg_confidence || 91) - 2),
              lat: hs.latitude - 0.003,
              lon: hs.longitude - 0.004,
              latStr: `${(hs.latitude - 0.003).toFixed(4)}° N`,
              lonStr: `${(hs.longitude - 0.004).toFixed(4)}° E`,
              timeSpike: "ISFR Trend: " + hs.forest_trend,
              description: `Canopy clearance and forest fragmentation within ${hs.name} perimeter.`,
            },
          ];

      const distribution = Object.entries(hs.type_counts).map(([name, val]) => ({
        name,
        value: val,
        color: name === "Deforestation" ? "#00D284" : name === "Mining" ? "#F79009" : "#FF4D4D",
      }));

      if (distribution.length === 0) {
        distribution.push({ name: "Mining", value: 60, color: "#F79009" });
        distribution.push({ name: "Deforestation", value: 40, color: "#00D284" });
      }

      return {
        id: `hs-${hs.id}`,
        name: hs.name,
        lat: hs.latitude,
        lon: hs.longitude,
        latStr: `${hs.latitude.toFixed(4)}° ${hs.latitude >= 0 ? "N" : "S"}`,
        lonStr: `${hs.longitude.toFixed(4)}° ${hs.longitude >= 0 ? "E" : "W"}`,
        beforeDate: "Jan 2023",
        afterDate: "Aug 2024",
        totalAreaHa: hs.total_area_ha || 18.5,
        areaChangePct: 28,
        changeTypesCount: Math.max(1, Object.keys(hs.type_counts).length),
        avgConfidence: Math.round(hs.avg_confidence || 91),
        suspiciousSitesCount: detList.length,
        anomalies: detList,
        distribution,
        timeline: [
          { month: "Jan 23", area: Math.max(1, (hs.total_area_ha || 10) * 0.15) },
          { month: "Jul 23", area: Math.max(2, (hs.total_area_ha || 10) * 0.35) },
          { month: "Jan 24", area: Math.max(3, (hs.total_area_ha || 10) * 0.65) },
          { month: "Aug 24", area: Math.max(4, hs.total_area_ha || 18.5), note: "Spike" },
        ],
      };
    });

    const combined = [...PRESET_LOCATIONS];
    for (const dh of dynamicFromHotspots) {
      if (!combined.some((c) => c.name.toLowerCase() === dh.name.toLowerCase())) {
        combined.push(dh);
      }
    }
    return combined;
  }, [backendHotspots]);

  // URL search effect
  useEffect(() => {
    const q = searchParams.get("search")?.toLowerCase() ?? "";
    if (!q) return;
    const found = allLocations.find((l) => l.name.toLowerCase().includes(q) || l.id.includes(q));
    if (found) { setLoc(found); setSelAnomaly(found.anomalies[0]); }
  }, [searchParams, allLocations]);

  // Backend polling
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [s, l, a, sc, h] = await Promise.allSettled([
        api.getStats(),
        api.getLocations(),
        api.getAlerts(),
        api.getScans(),
        api.getHotspots(),
      ]);
      if (!active) return;
      if (s.status === "fulfilled") setBackendStats(s.value);
      if (l.status === "fulfilled") setBackendLocations(l.value);
      if (a.status === "fulfilled") setBackendAlerts(a.value);
      if (sc.status === "fulfilled") setBackendScans(sc.value);
      if (h.status === "fulfilled") setBackendHotspots(h.value);
    };
    void load();
    const t = window.setInterval(load, 30_000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const handleSelectLoc = (l: PresetLocation) => {
    setLoc(l);
    setSelAnomaly(l.anomalies[0]);
  };

  const toggleLayer = (type: string) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const toggleAllLayers = () => {
    const allOn = Object.values(layerVisibility).every(Boolean) && showHeatmap;
    setShowHeatmap(!allOn);
    setLayerVisibility({
      Construction: !allOn,
      Deforestation: !allOn,
      Mining: !allOn,
    });
  };

  const visibleAnomalies = loc.anomalies.filter((a) => layerVisibility[a.type] !== false);

  const totalArea = backendStats?.total_changed_area_ha ?? loc.totalAreaHa;
  const totalScans = backendStats?.total_scans ?? 127;
  const monitoredSites = backendLocations.length || loc.suspiciousSitesCount;

  const KPI = [
    { label: "Total Area Changed", value: `${totalArea.toFixed(1)} ha`, sub: `+${loc.areaChangePct}% vs last scan`, accent: "#FF4D4D", Icon: ShieldAlert, bars: loc.timeline.map((t) => t.area) },
    { label: "Change Categories", value: loc.changeTypesCount, sub: "Distinct change types detected", accent: "#F79009", Icon: Layers, bars: [1,2,2,3,3,3] },
    { label: "Avg Confidence", value: `${loc.avgConfidence}%`, sub: "AI model confidence score", accent: "#00D284", Icon: CheckCircle2, bars: [85,87,89,90,91,92] },
    { label: "Monitored Sites", value: monitoredSites, sub: `${totalScans} total scans`, accent: "#00B4D8", Icon: MapPin, bars: [3,4,5,5,6,monitoredSites] },
  ];

  return (
    <div className="min-h-screen bg-transparent text-[var(--theme-text)] p-4 sm:p-6 transition-colors duration-300">
      <div className="mx-auto max-w-[1480px] space-y-5">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[.06] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-[#00D284] shadow-[0_0_8px_#00D284] animate-pulse" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-[.18em] text-[#00D284]">
                Autonomous Change-Forensics Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Change Detection Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Real satellite imagery · Mapbox GL · {loc.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" /> Site:
            </span>
            {PRESET_LOCATIONS.map((l) => (
              <button key={l.id} type="button" onClick={() => handleSelectLoc(l)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  l.id === loc.id
                    ? "border border-[#00D284]/50 bg-[#00D284]/15 text-white shadow-[0_0_12px_rgba(0,210,132,0.2)]"
                    : "border border-white/10 bg-white/[.04] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {l.name.split(" ")[0]}
              </button>
            ))}
            {allLocations.length > PRESET_LOCATIONS.length && (
              <div className="relative flex items-center">
                <select
                  value={loc.id}
                  onChange={(e) => {
                    const selected = allLocations.find((x) => x.id === e.target.value);
                    if (selected) handleSelectLoc(selected);
                  }}
                  className="h-8 rounded-lg border border-cyan-500/30 bg-[#0A1625] px-2.5 text-xs font-medium text-cyan-300 outline-none transition hover:border-cyan-400 focus:border-cyan-400 cursor-pointer shadow-sm"
                >
                  <option value="" disabled>All Monitored Regions ({allLocations.length})</option>
                  {allLocations.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#0A1625] text-white">
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KPI.map(({ label, value, sub, accent, Icon, bars }) => {
            const max = Math.max(...bars, 1);
            return (
              <div key={label} className="relative rounded-2xl border border-white/[.07] bg-[#0A1625] p-4 shadow-lg overflow-hidden">
                <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full blur-2xl opacity-[.07]" style={{ background: accent }} />
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: `${accent}40`, background: `${accent}18` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>
                <div className="mt-3 flex items-end gap-0.5 h-5">
                  {bars.map((v, i) => (
                    <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(3, (v / max) * 20)}px`, background: `${accent}80` }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── MAIN: MAP + DETECTIONS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* LEFT: MAP */}
          <div className="lg:col-span-8">
            {/* Outer card — NO overflow-hidden so Mapbox renders correctly */}
            <div
              className={`relative rounded-2xl border border-[#1D2D42] bg-[#0A1625] shadow-2xl ${
                fullscreen ? "fixed inset-4 z-50" : ""
              }`}
              style={fullscreen ? {} : { height: `${MAP_HEIGHT + 48}px` }}
            >
              {/* Map lives here — clipped with borderRadius via clip-path instead of overflow:hidden */}
              <div
                className="relative"
                style={{
                  borderRadius: "1rem",
                  clipPath: "inset(0 0 48px 0 round 1rem)",
                  height: fullscreen ? "calc(100% - 48px)" : `${MAP_HEIGHT}px`,
                }}
              >
                <SatelliteDetectionMap
                  location={loc}
                  anomalies={loc.anomalies}
                  showHeatmap={showHeatmap}
                  layerVisibility={layerVisibility}
                  selectedAnomaly={selAnomaly}
                  onAnomalySelect={setSelAnomaly}
                  mapHeightPx={fullscreen ? (typeof window !== "undefined" ? window.innerHeight - 120 : 600) : MAP_HEIGHT}
                />
              </div>

              {/* Fullscreen toggle */}
              <button
                type="button"
                onClick={() => setFullscreen((f) => !f)}
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="absolute top-2.5 right-2.5 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[#07111D]/90 text-slate-300 backdrop-blur-md hover:text-white transition-all"
              >
                {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>

              {/* Filter strip — bottom 48px of the card */}
              <div className="absolute bottom-0 left-0 right-0 h-12 flex items-center justify-between gap-2 border-t border-white/[.06] bg-[#0A1625]/98 backdrop-blur-md px-4 rounded-b-2xl">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Real WebGL Heatmap Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowHeatmap((h) => !h)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-mono font-semibold transition-all ${
                      showHeatmap
                        ? "border border-cyan-400/60 bg-cyan-500/20 text-cyan-200 shadow-[0_0_10px_rgba(0,180,216,0.3)]"
                        : "border border-white/10 bg-white/5 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${showHeatmap ? "bg-cyan-400 shadow-[0_0_6px_#00B4D8]" : "bg-slate-600"}`} />
                    Heatmap
                  </button>

                  {/* Individual Layers: Construction, Deforestation, Mining */}
                  {(["Construction", "Deforestation", "Mining"] as const).map((type) => {
                    const c = ANOMALY_CFG[type];
                    const IcoComp = c.icon;
                    const active = layerVisibility[type] !== false;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleLayer(type)}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-mono font-semibold transition-all border ${
                          active
                            ? `${c.pillBorder} ${c.pillBg} ${c.pillText} shadow-[0_0_10px_${c.color}25]`
                            : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <IcoComp className="h-2.5 w-2.5" style={{ color: active ? c.color : "#64748b" }} />
                        {type}
                      </button>
                    );
                  })}

                  {/* Toggle All Layers */}
                  <button
                    type="button"
                    onClick={toggleAllLayers}
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-mono text-slate-400 hover:border-white/20 hover:text-white transition-all ml-1"
                  >
                    All Layers
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-500 shrink-0">
                  <Crosshair className="h-3 w-3 text-cyan-400" />
                  <span>{loc.latStr} · {loc.lonStr}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: DETECTIONS */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="flex flex-col h-full rounded-2xl border border-[#1D2D42] bg-[#0A1625] p-5 shadow-2xl" style={{ minHeight: `${MAP_HEIGHT + 48}px` }}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/[.08] pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Detected Changes</h3>
                </div>
                <span className="flex items-center gap-1 rounded-full border border-[#FF4D4D]/40 bg-[#FF4D4D]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#FF8585]">
                  {visibleAnomalies.length} High Priority
                </span>
              </div>

              {/* List */}
              <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
                {visibleAnomalies.map((anomaly) => {
                  const isSelected = selAnomaly.id === anomaly.id;
                  const c = ANOMALY_CFG[anomaly.type] ?? ANOMALY_CFG.Others;
                  const IcoComp = c.icon;
                  return (
                    <div key={anomaly.id} onClick={() => setSelAnomaly(anomaly)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-[#00D284]/60 bg-[#00D284]/[.07] shadow-[0_0_18px_rgba(0,210,132,0.13)]"
                          : "border-white/[.06] bg-white/[.02] hover:border-white/15 hover:bg-white/[.04]"
                      }`}>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${c.border} ${c.bg} ${c.text}`}>
                        <IcoComp className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate">{anomaly.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-400">
                          <span><strong className="text-slate-200">{anomaly.areaHa} ha</strong></span>
                          <span>·</span>
                          <span><strong className="text-emerald-400">{anomaly.confidence}%</strong> conf</span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">{anomaly.timeSpike}</p>
                      </div>
                      {isSelected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D284] shadow-[0_0_6px_#00D284] animate-pulse" />}
                    </div>
                  );
                })}
              </div>

              {/* Forensic detail */}
              <div className="mt-3 rounded-xl border border-white/[.06] bg-white/[.02] p-3.5">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">Forensic Intelligence</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">{selAnomaly.description}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/[.03] p-2">
                    <p className="text-[9px] text-slate-500 mb-1">Coordinates</p>
                    <p className="text-[10px] font-mono text-slate-200">{selAnomaly.latStr}</p>
                    <p className="text-[10px] font-mono text-slate-200">{selAnomaly.lonStr}</p>
                  </div>
                  <div className="rounded-lg bg-white/[.03] p-2">
                    <p className="text-[9px] text-slate-500 mb-1">Detection</p>
                    <p className="text-[10px] font-mono font-bold text-white">{selAnomaly.areaHa} ha</p>
                    <p className="text-[10px] font-mono text-emerald-400">{selAnomaly.confidence}% conf</p>
                  </div>
                </div>
                <button type="button" onClick={() => setReportOpen(true)}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#00D284]/40 bg-[#00D284]/10 py-2 text-xs font-semibold text-[#00D284] transition-all hover:bg-[#00D284]/20">
                  <FileText className="h-3.5 w-3.5" /> Generate Evidence Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM: CHARTS + ALERTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Timeline */}
          <div className="lg:col-span-5 rounded-2xl border border-[#1D2D42] bg-[#0A1625] p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Change Timeline</p>
                <h3 className="text-sm font-bold text-white">{loc.name.split(" ").slice(0, 2).join(" ")}</h3>
              </div>
              <span className="text-[11px] font-mono text-[#FF4D4D]">{loc.areaChangePct}% increase</span>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={loc.timeline} margin={{ top: 4, right: 0, left: -26, bottom: 0 }}>
                <defs>
                  <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D284" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#00D284" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ background: "#0F1E30", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#94a3b8" }} itemStyle={{ color: "#00D284" }} />
                <Area type="monotone" dataKey="area" name="Area (ha)" stroke="#00D284" strokeWidth={2} fill="url(#aG)"
                  dot={(props: any) => {
                    const d = loc.timeline[props.index];
                    return <circle key={props.index} cx={props.cx} cy={props.cy} r={d?.note ? 5 : 2} fill={d?.note ? "#FF4D4D" : "#00D284"} />;
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution */}
          <div className="lg:col-span-3 rounded-2xl border border-[#1D2D42] bg-[#0A1625] p-5 shadow-lg">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1">Distribution</p>
            <h3 className="text-sm font-bold text-white mb-3">By Change Type</h3>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={loc.distribution} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                  {loc.distribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip contentStyle={{ background: "#0F1E30", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {loc.distribution.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs text-slate-400">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold text-white">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts + Scans */}
          <div className="lg:col-span-4 rounded-2xl border border-[#1D2D42] bg-[#0A1625] p-5 shadow-lg flex flex-col gap-4">
            {/* Active alerts */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Active Alerts</p>
                <Link href="/alerts" className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5">
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {(backendAlerts.filter((a) => a.status === "triggered" || a.status === "active").slice(0, 3).length > 0
                  ? backendAlerts.filter((a) => a.status === "triggered" || a.status === "active").slice(0, 3)
                  : [
                      { id: 1, location_name: loc.name, change_type_filter: "Deforestation", threshold_ha: 50, status: "triggered" },
                      { id: 2, location_name: "Kalimantan, Borneo", change_type_filter: "Mining", threshold_ha: 80, status: "active" },
                    ] as AlertItem[]
                ).map((alert) => {
                  const c = ANOMALY_CFG[alert.change_type_filter as keyof typeof ANOMALY_CFG] ?? ANOMALY_CFG.Others;
                  const IcoComp = c.icon;
                  return (
                    <div key={alert.id} className="flex items-center gap-3 rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full animate-pulse"
                        style={{ background: alert.status === "triggered" ? "#FF4D4D" : "#F79009", boxShadow: `0 0 6px ${alert.status === "triggered" ? "#FF4D4D" : "#F79009"}` }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{alert.location_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{alert.change_type_filter} · {alert.threshold_ha} ha</p>
                      </div>
                      <IcoComp className="h-3.5 w-3.5 shrink-0" style={{ color: c.color }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Latest scans */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Latest Scans</p>
                <span className="text-[10px] text-slate-500">{backendScans.length || 0} queued</span>
              </div>
              <div className="space-y-1.5">
                {backendScans.slice(0, 3).length > 0
                  ? backendScans.slice(0, 3).map((scan) => (
                      <Link key={scan.id} href={`/analyze?scan_id=${scan.id}`}
                        className="flex items-center gap-3 rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2 transition-all hover:border-white/10 hover:bg-white/[.04]">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${scan.status === "completed" ? "bg-emerald-400" : scan.status === "failed" ? "bg-red-400" : "bg-sky-400"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-200 truncate">Scan #{scan.id}</p>
                          <p className="text-[10px] text-slate-500">{new Date(scan.created_at).toLocaleDateString()} · {scan.status}</p>
                        </div>
                        <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
                      </Link>
                    ))
                  : [loc, PRESET_LOCATIONS[1]].map((l, i) => (
                      <Link key={i} href="/analyze"
                        className="flex items-center gap-3 rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2 transition-all hover:border-white/10 hover:bg-white/[.04]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-200 truncate">{l.name.split(" ").slice(0, 2).join(" ")}</p>
                          <p className="text-[10px] text-slate-500">{l.afterDate} · completed</p>
                        </div>
                        <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
                      </Link>
                    ))
                }
                <Link href="/analyze"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 py-2.5 text-[11px] text-slate-500 hover:border-emerald-400/30 hover:text-emerald-400 transition-all">
                  + Upload new comparison
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── REPORT MODAL ── */}
      {reportOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setReportOpen(false)}>
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1625] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setReportOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00D284]/30 bg-[#00D284]/10">
                <FileText className="h-5 w-5 text-[#00D284]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Forensic Evidence Report</h2>
                <p className="text-xs text-slate-400">{loc.name}</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-4 mb-4 space-y-2">
              {[
                ["Type", selAnomaly.type],
                ["Area Affected", `${selAnomaly.areaHa} ha`],
                ["Confidence", `${selAnomaly.confidence}%`],
                ["Coordinates", `${selAnomaly.latStr}, ${selAnomaly.lonStr}`],
                ["Change Spike", selAnomaly.timeSpike],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">{selAnomaly.description}</p>
            <div className="flex gap-3">
              <Link href="/reports" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10">
                <FileText className="h-4 w-4" /> Reports
              </Link>
              <Link href="/analyze" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#00D284]/40 bg-[#00D284]/15 py-2.5 text-sm font-semibold text-[#00D284] transition-all hover:bg-[#00D284]/25">
                <Download className="h-4 w-4" /> Analyze
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
