"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import type { DetectionItem, LocationItem } from "@/lib/api";
import { API_BASE_URL, type LiveMapFeature } from "@/lib/api";

type DetectionFeature = Feature<Geometry, {
  id: number;
  changeType: string;
  confidence: number;
  areaHa: number;
}>;

interface MapboxMonitoringMapProps {
  location: LocationItem | null;
  detections: DetectionItem[];
  layer: "overlay" | "heatmap" | "base";
  opacity: number;
  onDetectionSelect?: (id: number) => void;
  showLiveData: boolean;
  onLiveFeatureSelect?: (feature: LiveMapFeature) => void;
  cameraTarget?: { center?: [number, number]; bounds?: [[number, number], [number, number]]; key: string } | null;
  beforeImageUrl?: string;
  afterImageUrl?: string;
}

export default function MapboxMonitoringMap({
  location,
  detections,
  layer,
  opacity,
  onDetectionSelect,
  showLiveData,
  onLiveFeatureSelect,
  cameraTarget,
  beforeImageUrl,
  afterImageUrl,
}: MapboxMonitoringMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const [liveFeatures, setLiveFeatures] = useState<LiveMapFeature[]>([]);
  const [liveDataStatus, setLiveDataStatus] = useState("Zoom in to load live site records");
  const selectCallbackRef = useRef(onDetectionSelect);
  const liveSelectCallbackRef = useRef(onLiveFeatureSelect);
  const detectionsRef = useRef(detections);
  const liveFeaturesRef = useRef(liveFeatures);
  const evidenceRef = useRef({ beforeImageUrl, afterImageUrl });
  const hoverPopupRef = useRef<import("mapbox-gl").Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(() => token ? "" : "Mapbox token is missing. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to frontend/.env.local and restart Next.js.");

  const featureCollection = useMemo<FeatureCollection<Geometry, DetectionFeature["properties"]>>(() => ({
    type: "FeatureCollection",
    features: detections.map((detection): DetectionFeature => {
      const polygon = detection.polygon as { type?: string; coordinates?: [number, number][][] } | undefined;
      const hasPolygon = polygon?.type === "Polygon" && Boolean(polygon.coordinates?.[0]?.length);
      const geometry: Geometry = hasPolygon
        ? polygon as Geometry
        : ({ type: "Point", coordinates: [detection.centroid_lon, detection.centroid_lat] } satisfies Point);
      return {
        type: "Feature",
        id: detection.id,
        geometry,
        properties: {
          id: detection.id,
          changeType: detection.change_type,
          confidence: detection.confidence,
          areaHa: detection.area_hectares,
        },
      };
    }),
  }), [detections]);

  useEffect(() => {
    selectCallbackRef.current = onDetectionSelect;
    liveSelectCallbackRef.current = onLiveFeatureSelect;
    detectionsRef.current = detections;
    liveFeaturesRef.current = liveFeatures;
    evidenceRef.current = { beforeImageUrl, afterImageUrl };
  }, [onDetectionSelect, onLiveFeatureSelect, detections, liveFeatures, beforeImageUrl, afterImageUrl]);

  const liveFeatureCollection = useMemo<FeatureCollection<Point, { id: string; category: string; name: string; lat: number; lon: number; source: string; sourceUrl: string; tags: string }>>(() => ({
    type: "FeatureCollection",
    features: liveFeatures.map((feature) => ({ type: "Feature", geometry: { type: "Point", coordinates: [feature.lon, feature.lat] }, properties: { id: feature.id, category: feature.category, name: feature.name, lat: feature.lat, lon: feature.lon, source: feature.source, sourceUrl: feature.source_url, tags: JSON.stringify(feature.tags) } })),
  }), [liveFeatures]);

  useEffect(() => {
    let disposed = false;
    let map: MapboxMap | null = null;

    if (!token) return;
    if (!containerRef.current) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (disposed || !containerRef.current) return;
      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: location ? [location.longitude, location.latitude] : [0, 20],
        zoom: location ? 11 : 1.5,
        attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      if (location) {
        markerRef.current = new mapboxgl.Marker({ color: "#22d3ee" })
          .setLngLat([location.longitude, location.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 22 }).setText(location.name))
          .addTo(map);
      }

      map.on("load", () => {
        if (disposed) return;
        const emptyCollection: FeatureCollection<Point, DetectionFeature["properties"]> = {
          type: "FeatureCollection",
          features: [],
        };
        map?.addSource("detection-polygons", { type: "geojson", data: featureCollection });
        map?.addSource("detection-centroids", { type: "geojson", data: emptyCollection });
        map?.addSource("terratrace-live-features", { type: "geojson", data: liveFeatureCollection });
        const currentDate = new Date().toISOString().slice(0, 10);
        const yearStart = `${currentDate.slice(0, 4)}-01-01`;
        map?.addSource("gfw-forest-alerts", { type: "raster", tiles: [`https://tiles.globalforestwatch.org/umd_glad_landsat_alerts/latest/dynamic/{z}/{x}/{y}.png?start_date=${yearStart}&end_date=${currentDate}&confirmed_only=false`], tileSize: 256, attribution: "GLAD alerts · Global Forest Watch / University of Maryland" });
        map?.addLayer({ id: "gfw-forest-alerts-layer", type: "raster", source: "gfw-forest-alerts", paint: { "raster-opacity": 0.76 } });
        map?.addLayer({ id: "terratrace-live-points", type: "circle", source: "terratrace-live-features", paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4, 10, 8],
          "circle-color": ["match", ["get", "category"], "mining", "#fb554f", "#d3a2ff"],
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5,
          "circle-opacity": 0.95, "circle-emissive-strength": 0.8,
        } });
        map?.addLayer({
          id: "detection-heatmap",
          type: "heatmap",
          source: "detection-centroids",
          maxzoom: 16,
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "confidence"], 0, 0, 100, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 15, 1.8],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 18, 15, 38],
            "heatmap-opacity": 0.78,
          },
        });
        map?.addLayer({
          id: "detection-polygons-fill",
          type: "fill",
          source: "detection-polygons",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "fill-color": ["match", ["get", "changeType"], "Deforestation", "#22c55e", "Mining", "#f59e0b", "Construction", "#ef4444", "#22d3ee"],
            "fill-opacity": 0.35,
          },
        });
        map?.addLayer({
          id: "detection-polygons-line",
          type: "line",
          source: "detection-polygons",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "line-color": ["match", ["get", "changeType"], "Deforestation", "#22c55e", "Mining", "#f59e0b", "Construction", "#ef4444", "#22d3ee"],
            "line-width": 2,
          },
        });
        map?.addLayer({
          id: "detection-points",
          type: "circle",
          source: "detection-polygons",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 7,
            "circle-color": ["match", ["get", "changeType"], "Deforestation", "#22c55e", "Mining", "#f59e0b", "Construction", "#ef4444", "#22d3ee"],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });
        map?.on("click", "detection-polygons-fill", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "number") selectCallbackRef.current?.(id);
        });
        map?.on("click", "detection-points", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "number") selectCallbackRef.current?.(id);
        });
        map?.on("mouseenter", "detection-polygons-fill", () => { if (map) map.getCanvas().style.cursor = "pointer"; });
        map?.on("mouseleave", "detection-polygons-fill", () => { if (map) map.getCanvas().style.cursor = ""; hoverPopupRef.current?.remove(); });
        map?.on("mouseenter", "detection-points", () => { if (map) map.getCanvas().style.cursor = "pointer"; });
        map?.on("mouseleave", "detection-points", () => { if (map) map.getCanvas().style.cursor = ""; hoverPopupRef.current?.remove(); });
        map?.on("mousemove", "detection-polygons-fill", (event) => {
          const hit = event.features?.[0];
          const id = hit?.properties?.id;
          const feature = typeof id === "number" ? detectionsRef.current.find((item) => item.id === id) : undefined;
          if (!feature || !map) return;
          selectCallbackRef.current?.(feature.id);
          const { Popup } = mapboxgl;
          const card = document.createElement("div"); card.className = "map-evidence-popup";
          const title = document.createElement("strong"); title.textContent = `${feature.change_type} · ${feature.area_hectares.toFixed(2)} ha`; card.append(title);
          const confidence = document.createElement("p"); confidence.textContent = `${feature.confidence.toFixed(1)}% model confidence`; card.append(confidence);
          if (evidenceRef.current.beforeImageUrl && evidenceRef.current.afterImageUrl) {
            const images = document.createElement("div"); images.className = "map-evidence-pair";
            for (const [label, src] of [["Before", evidenceRef.current.beforeImageUrl], ["After", evidenceRef.current.afterImageUrl]]) { const wrapper = document.createElement("div"); const image = document.createElement("img"); image.src = src; image.alt = `${label} satellite capture`; const caption = document.createElement("span"); caption.textContent = label; wrapper.append(image, caption); images.append(wrapper); }
            card.append(images);
          }
          hoverPopupRef.current?.remove(); hoverPopupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: "280px" }).setLngLat(event.lngLat).setDOMContent(card).addTo(map);
        });
        map?.on("mousemove", "detection-points", (event) => {
          const id = event.features?.[0]?.properties?.id;
          const feature = typeof id === "number" ? detectionsRef.current.find((item) => item.id === id) : undefined;
          if (!feature || !map) return;
          selectCallbackRef.current?.(feature.id);
          const card = document.createElement("div"); card.className = "map-evidence-popup";
          const title = document.createElement("strong"); title.textContent = `${feature.change_type} · ${feature.area_hectares.toFixed(2)} ha`; card.append(title);
          const confidence = document.createElement("p"); confidence.textContent = `${feature.confidence.toFixed(1)}% model confidence`; card.append(confidence);
          if (evidenceRef.current.beforeImageUrl && evidenceRef.current.afterImageUrl) { const images = document.createElement("div"); images.className = "map-evidence-pair"; for (const [label, src] of [["Before", evidenceRef.current.beforeImageUrl], ["After", evidenceRef.current.afterImageUrl]]) { const wrapper=document.createElement("div"); const image=document.createElement("img"); image.src=src; image.alt=`${label} satellite capture`; const caption=document.createElement("span"); caption.textContent=label; wrapper.append(image,caption); images.append(wrapper); } card.append(images); }
          hoverPopupRef.current?.remove(); hoverPopupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: "280px" }).setLngLat(event.lngLat).setDOMContent(card).addTo(map);
        });
        map?.on("click", "terratrace-live-points", (event) => {
          const props = event.features?.[0]?.properties;
          if (!props) return;
          const feature = liveFeaturesRef.current.find((item) => item.id === props.id);
          if (feature) liveSelectCallbackRef.current?.(feature);
        });
        map?.on("mouseenter", "terratrace-live-points", () => { if (map) map.getCanvas().style.cursor = "pointer"; });
        map?.on("mouseleave", "terratrace-live-points", () => { if (map) map.getCanvas().style.cursor = ""; });
        map?.on("mousemove", "terratrace-live-points", (event) => {
          const props = event.features?.[0]?.properties;
          if (!props || !map) return;
          const card = document.createElement("div"); card.className = "map-evidence-popup";
          const title = document.createElement("strong"); title.textContent = String(props.name ?? "Environmental record"); card.append(title);
          const kind = document.createElement("p"); kind.textContent = props.category === "mining" ? "Mapped mine / quarry record · OSM" : "Protected or nature reserve · OSM"; card.append(kind);
          const tags = document.createElement("p"); tags.className = "map-popup-tags"; tags.textContent = String(props.tags ?? "").replace(/[{}\"]+/g, "").replace(/,/g, " · "); card.append(tags);
          hoverPopupRef.current?.remove(); hoverPopupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: "280px" }).setLngLat(event.lngLat).setDOMContent(card).addTo(map);
        });
        setMapReady(true);
      });

      map.on("error", () => {
        if (!disposed) setMapError("Mapbox could not load the map. Check the token and its allowed URL settings.");
      });
    }).catch(() => {
      if (!disposed) setMapError("Could not load Mapbox GL JS.");
    });

    return () => {
      disposed = true;
      markerRef.current?.remove();
      hoverPopupRef.current?.remove(); hoverPopupRef.current = null;
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  // Map initialization is deliberately tied to the public token only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !cameraTarget) return;
    if (cameraTarget.bounds) map.fitBounds(cameraTarget.bounds, { padding: 70, maxZoom: 13, duration: 1200 });
    else if (cameraTarget.center) map.flyTo({ center: cameraTarget.center, zoom: 11, duration: 1200 });
  }, [cameraTarget, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loadViewportRecords = async () => {
      const zoom = map.getZoom();
      if (zoom < 5) { setLiveFeatures([]); setLiveDataStatus("Zoom in to load live mine and habitat records"); return; }
      const bounds = map.getBounds();
      if (!bounds) return;
      try {
        setLiveDataStatus("Loading current OpenStreetMap records…");
        const params = new URLSearchParams({ west: String(bounds.getWest()), south: String(bounds.getSouth()), east: String(bounds.getEast()), north: String(bounds.getNorth()) });
        const response = await fetch(`${API_BASE_URL}/api/map/live-features?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Live map data is unavailable");
        const data = await response.json() as { features: LiveMapFeature[]; count: number; source: string };
        setLiveFeatures(data.features);
        setLiveDataStatus(`${data.count.toLocaleString()} mapped sites · OpenStreetMap`);
      } catch { setLiveDataStatus("Live site records are unavailable; satellite alerts may still display"); }
    };
    const onMoveEnd = () => { clearTimeout(timer); timer = setTimeout(() => void loadViewportRecords(), 650); };
    void loadViewportRecords();
    map.on("moveend", onMoveEnd);
    return () => { clearTimeout(timer); map.off("moveend", onMoveEnd); };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    (map.getSource("terratrace-live-features") as import("mapbox-gl").GeoJSONSource | undefined)?.setData(liveFeatureCollection);
    for (const id of ["terratrace-live-points", "gfw-forest-alerts-layer"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showLiveData ? "visible" : "none");
  }, [liveFeatureCollection, mapReady, showLiveData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !location) return;
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (mapRef.current !== map) return;
      if (markerRef.current) {
        markerRef.current.setLngLat([location.longitude, location.latitude]);
        markerRef.current.getPopup()?.setText(location.name);
      } else {
        markerRef.current = new mapboxgl.Marker({ color: "#22d3ee" })
          .setLngLat([location.longitude, location.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 22 }).setText(location.name))
          .addTo(map);
      }
      map.easeTo({ center: [location.longitude, location.latitude], zoom: 11, duration: 700 });
    });
  }, [location, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const polygonSource = map.getSource("detection-polygons") as import("mapbox-gl").GeoJSONSource | undefined;
    polygonSource?.setData(featureCollection);
    const pointSource = map.getSource("detection-centroids") as import("mapbox-gl").GeoJSONSource | undefined;
    const centroidCollection: FeatureCollection<Point, DetectionFeature["properties"]> = {
      type: "FeatureCollection",
      features: featureCollection.features.map((feature) => {
        let coordinates: [number, number] = [0, 0];
        if (feature.geometry.type === "Point") {
          coordinates = feature.geometry.coordinates as [number, number];
        } else if (feature.geometry.type === "Polygon") {
          const ring = feature.geometry.coordinates[0] ?? [];
          if (ring.length) {
            coordinates = [
              ring.reduce((sum, coordinate) => sum + coordinate[0], 0) / ring.length,
              ring.reduce((sum, coordinate) => sum + coordinate[1], 0) / ring.length,
            ];
          }
        }
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates },
          properties: feature.properties,
        };
      }),
    };
    pointSource?.setData(centroidCollection);
    for (const layerId of ["detection-heatmap", "detection-polygons-fill", "detection-polygons-line", "detection-points"]) {
      if (!map.getLayer(layerId)) continue;
      const visible = layer === "heatmap" ? layerId === "detection-heatmap" : layer === "overlay" && layerId !== "detection-heatmap";
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    }
    map.setPaintProperty("detection-heatmap", "heatmap-opacity", 0.78 * opacity);
    map.setPaintProperty("detection-polygons-fill", "fill-opacity", 0.35 * opacity);
    map.setPaintProperty("detection-polygons-line", "line-opacity", opacity);
    map.setPaintProperty("detection-points", "circle-opacity", opacity);
  }, [featureCollection, layer, mapReady, opacity]);

  return (
    <div className="absolute inset-0 bg-[#071522]">
      <div ref={containerRef} className="absolute inset-0" aria-label="Interactive satellite map" />
      {showLiveData && <div className="pointer-events-none absolute bottom-14 left-3 z-10 rounded-lg border border-white/15 bg-slate-950/80 px-3 py-2 text-[10px] text-slate-200 shadow-lg backdrop-blur-md">{liveDataStatus} <span className="text-slate-400">· Red: forest alerts / mines · Violet: protected areas</span></div>}
      {mapError && <div role="status" className="absolute inset-0 z-10 flex items-center justify-center bg-[#071522] p-6 text-center text-sm text-amber-100">{mapError}</div>}
    </div>
  );
}
