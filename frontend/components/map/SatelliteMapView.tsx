"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { 
  MapPin, 
  Layers, 
  Crosshair,
  Info,
  Search,
  Download,
  X,
  Globe2,
} from "lucide-react";
import { api, DetectionItem, LocationItem, AnalysisResults, GeocodeResult, LiveMapFeature } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import MapboxMonitoringMap from "@/components/map/MapboxMonitoringMap";

interface SatelliteMapViewProps {
  onSwitchToGlobe?: () => void;
  showGlobeToggle?: boolean;
}

export default function SatelliteMapView({ onSwitchToGlobe, showGlobeToggle }: SatelliteMapViewProps) {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [activeLocation, setActiveLocation] = useState<LocationItem | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [opacity, setOpacity] = useState<number>(0.8);
  const [activeLayer, setActiveLayer] = useState<"overlay" | "heatmap" | "base">("overlay");
  const [showLiveData, setShowLiveData] = useState(true);
  const [selectedDetection, setSelectedDetection] = useState<DetectionItem | null>(null);
  const [selectedLiveFeature, setSelectedLiveFeature] = useState<LiveMapFeature | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<GeocodeResult | null>(null);
  const [searchNotice, setSearchNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [cameraTarget, setCameraTarget] = useState<{ center?: [number, number]; bounds?: [[number, number], [number, number]]; key: string } | null>(null);
  const [region, setRegion] = useState({ country: "", state: "", district: "", area: "" });
  const [evidenceImages, setEvidenceImages] = useState<{ before: string; after: string }>({ before: "", after: "" });

  const selectLocation = useCallback(async (loc: LocationItem) => {
    setSearchNotice("");
    setActiveLocation(loc);
    setSelectedDetection(null);
    setSelectedLiveFeature(null);
    setResults(null);
    setEvidenceImages({ before: "", after: "" });
    // Find scan for this location
    const scans = await api.getScans().catch(() => []);
    const match = scans.find((s) => s.location_id === loc.id);
    if (match) {
      setEvidenceImages({ before: api.getAssetUrl(match.old_thumbnail), after: api.getAssetUrl(match.new_thumbnail) });
      const res = await api.getAnalysisResults(match.id).catch(() => null);
      if (res) setResults(res);
    } else {
      setResults(null);
    }
  }, []);

  const searchRegion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = [region.area, region.district, region.state, region.country].filter(Boolean).join(", ");
    if (query.length < 2) return;
    setSearching(true);
    setSearchNotice("");
    try { setSearchResults(await api.geocodePlace(query)); }
    catch (error) { setSearchNotice(error instanceof Error ? error.message : "Area search failed"); }
    finally { setSearching(false); }
  };

  const focusSearchResult = (place: GeocodeResult) => {
    const box = place.boundingbox?.map(Number);
    const key = `${place.lat}-${place.lon}`;
    setCameraTarget(box?.length === 4 ? { bounds: [[box[2], box[0]], [box[3], box[1]]], key } : { center: [place.lon, place.lat], key });
    setSearchResults([]);
    setSearchNotice(`Showing ${place.label}`);
  };

  const selectLiveFeature = async (feature: LiveMapFeature) => {
    setSelectedLiveFeature(feature);
    setSelectedDetection(null);
    setSelectedRegion(null);
    try { setSelectedRegion(await api.reverseGeocode(feature.lat, feature.lon)); } catch { /* Coordinates remain available if reverse geocoding is down. */ }
  };

  const downloadLiveRecord = () => {
    if (!selectedLiveFeature) return;
    const feature = selectedLiveFeature;
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] ?? character));
    const row = (label: string, value: string) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
    const address = selectedRegion?.address ?? {};
    const adminRows = [["Country",address.country],["State / province",address.state ?? address.region],["District / county",address.state_district ?? address.county ?? address.district],["Local area",address.city ?? address.town ?? address.village]].filter((entry): entry is [string,string] => Boolean(entry[1])).map(([label,value])=>row(label,value)).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>TerraTrace environmental site record</title><style>body{font:15px/1.6 Arial,sans-serif;color:#1f3026;max-width:850px;margin:48px auto;padding:0 24px}header{border-bottom:3px solid #287653;padding-bottom:18px}h1{margin:0;color:#174b37}small{color:#586a5d}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #dce4d9}th{width:180px;color:#536457}.note{background:#eef3e8;padding:16px;border-left:4px solid #287653}a{color:#17664c}</style></head><body><header><h1>TerraTrace Site Record</h1><small>Environmental map feature · retrieved ${new Date().toLocaleString()}</small></header><table>${row("Feature", feature.name)}${row("Category", feature.category === "mining" ? "Mapped mine / quarry" : "Protected area / nature reserve")}${row("Coordinates", `${feature.lat.toFixed(6)}, ${feature.lon.toFixed(6)}`)}${adminRows}${Object.entries(feature.tags).slice(0,20).map(([key,value]) => row(key,value)).join("")}${row("Source",feature.source)}${row("Source record",feature.source_url)}</table><div class="note"><b>Change evidence:</b> This record identifies a mapped site or protected area; it does not prove recent environmental change. Verified before/after evidence requires satellite imagery for both dates and a TerraTrace change analysis. Use the Analysis page to create that report.</div><p><a href="${escapeHtml(feature.source_url)}">Open source record</a></p></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `terratrace-${feature.category}-${feature.osm_id}.html`; anchor.click(); URL.revokeObjectURL(url);
  };

  const searchParams = useSearchParams();

  useEffect(() => {
    api.getLocations().then((locs) => {
      setLocations(locs);
      const requestedId = searchParams.get("location_id");
      const requestedName = searchParams.get("search")?.trim().toLocaleLowerCase();
      const selected = requestedId
        ? locs.find((loc) => String(loc.id) === requestedId)
        : requestedName
          ? locs.find((loc) => loc.name.toLocaleLowerCase().includes(requestedName))
          : locs[0];
      if (selected) void selectLocation(selected);
      else if (requestedName || requestedId) setSearchNotice("No matching monitoring location. Choose one from the location list.");
    }).catch(() => setLocations([]));
  }, [selectLocation, searchParams]);

  return (
    <div className="relative flex-1 flex flex-col h-full w-full overflow-hidden">
      {/* Top Map Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {showGlobeToggle && onSwitchToGlobe && (
            <button
              type="button"
              onClick={onSwitchToGlobe}
              className="flex h-11 items-center gap-2 rounded-xl border border-cyan-400/40 bg-[#061524]/95 px-3 text-xs font-semibold text-cyan-300 shadow-lg backdrop-blur-md transition-all hover:border-cyan-300 hover:bg-[#0c243a]"
            >
              <Globe2 className="h-4 w-4" />
              <span>3D Globe View</span>
            </button>
          )}
          <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-expanded={searchOpen} className="flex h-11 items-center gap-2 rounded-xl border border-emerald-900/50 bg-[#07140f]/95 px-3 text-xs text-slate-200 shadow-lg backdrop-blur-md transition-all hover:border-emerald-300/50 hover:shadow-[0_0_25px_rgba(34,197,94,.25)]"><Search className="h-4 w-4 text-emerald-300"/><span>Search area</span></button>
          
          {/* Location Selector */}
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-blue-900/60 bg-[#060E20]/90 p-1.5 shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md">
            {locations.map((loc) => (
              <button
                type="button"
                key={loc.id}
                onClick={() => selectLocation(loc)}
                aria-pressed={activeLocation?.id === loc.id}
                className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${
                  activeLocation?.id === loc.id
                    ? "bg-blue-600 text-white font-bold shadow-[0_0_12px_rgba(31,107,255,0.6)]"
                    : "text-slate-400 hover:bg-blue-950/60 hover:text-white"
                }`}
              >
                <MapPin className="h-3 w-3" />
                <span>{loc.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Layer & Opacity Controls */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-blue-900/60 bg-[#060E20]/90 px-2 py-2 text-xs font-mono shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md sm:gap-3 sm:px-3">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <select
              value={activeLayer}
              onChange={(e) => setActiveLayer(e.target.value as "overlay" | "heatmap" | "base")}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="overlay" className="bg-[#071329]">Detection Polygons</option>
              <option value="heatmap" className="bg-[#071329]">Change Heatmap</option>
              <option value="base" className="bg-[#071329]">Satellite Basemap</option>
            </select>
          </div>

          <div className="h-3.5 w-px bg-blue-900"></div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Opacity</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              aria-label="Layer opacity"
              className="w-16 cursor-pointer accent-cyan-400 sm:w-20"
            />
          </div>
          <label className="flex items-center gap-1.5 whitespace-nowrap text-slate-300"><input type="checkbox" checked={showLiveData} onChange={(event) => setShowLiveData(event.target.checked)} className="accent-red-400"/>Global risks</label>
        </div>
      </div>

      {searchOpen && <form onSubmit={searchRegion} className="absolute left-4 top-[4.5rem] z-30 w-[min(520px,calc(100%-2rem))] rounded-2xl border border-emerald-300/25 bg-[#081712]/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,.55)] backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Find a monitoring area</p><p className="text-xs text-slate-400">Search by country, state, district or local place</p></div><button type="button" onClick={() => {setSearchOpen(false);setSearchResults([]);}} aria-label="Close area search" className="rounded-lg p-2 text-slate-300 hover:bg-white/10"><X size={16}/></button></div>
        <div className="grid grid-cols-2 gap-2">{([['country','Country'],['state','State / province'],['district','District / county'],['area','Area / place']] as const).map(([key,label]) => <label key={key} className="text-[11px] text-slate-400">{label}<input value={region[key]} onChange={(event)=>setRegion({...region,[key]:event.target.value})} placeholder={label} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-300/50 focus:outline-none" /></label>)}</div>
        <button disabled={searching} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-semibold text-white transition-all hover:bg-emerald-600 hover:shadow-[0_0_24px_rgba(34,197,94,.3)] disabled:opacity-60"><Search size={15}/>{searching ? "Searching…" : "Search map"}</button>
        {searchResults.length>0 && <ul className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-[#06110b]">{searchResults.map((place,index)=><li key={`${place.lat}-${place.lon}-${index}`}><button type="button" onClick={()=>focusSearchResult(place)} className="w-full px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-emerald-900/50">{place.label}</button></li>)}</ul>}
      </form>}

      {/* Main Map Canvas Area */}
      {searchNotice && <p role="status" className="absolute left-4 top-20 z-30 max-w-[calc(100%-2rem)] rounded-lg border border-amber-300/30 bg-[#071329]/95 px-4 py-3 text-sm text-amber-100 shadow-xl">{searchNotice}</p>}
      <div className="relative flex-1 overflow-hidden bg-[#040814]">
        {/* Grid lines */}
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />

        {/* Center Satellite Canvas Display */}
        <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-8">
          <div className="relative aspect-square max-h-[82vh] w-full max-w-[850px] rounded-2xl overflow-hidden border border-blue-900/60 shadow-[0_0_80px_rgba(0,10,30,0.9)]">
            <MapboxMonitoringMap
              location={activeLocation}
              detections={results?.detections ?? []}
              layer={activeLayer}
              opacity={opacity}
              onDetectionSelect={(id) => { setSelectedDetection(results?.detections.find((detection) => detection.id === id) ?? null); setSelectedLiveFeature(null); }}
              showLiveData={showLiveData}
              onLiveFeatureSelect={(feature) => { void selectLiveFeature(feature); }}
              cameraTarget={cameraTarget}
              beforeImageUrl={evidenceImages.before}
              afterImageUrl={evidenceImages.after}
            />
            {activeLayer !== "base" && !results?.detections.length && (
              <div className="absolute inset-x-3 top-3 z-10 rounded-md border border-amber-200/20 bg-[#071329]/90 px-3 py-2 text-center text-xs text-amber-100 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">No detections for this location yet.</div>
            )}

            {/* Crosshair reticle */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="h-12 w-12 border border-cyan-400/30 rounded-full flex items-center justify-center">
                <div className="h-2 w-2 bg-cyan-400/80 rounded-full"></div>
              </div>
            </div>

            {/* Corner HUD markers */}
            <div className="hud-corner-tl" />
            <div className="hud-corner-tr" />
            <div className="hud-corner-bl" />
            <div className="hud-corner-br" />
          </div>
        </div>

        {/* Right Floating Inspection Drawer */}
        <div className="absolute right-4 top-20 bottom-14 z-20 flex w-80 max-w-[calc(100%-2rem)] flex-col gap-4 rounded-2xl border border-blue-900/60 bg-[#060E20]/90 p-5 shadow-[0_0_30px_rgba(0,0,0,0.6)] backdrop-blur-md max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-14 max-sm:max-h-[42vh] max-sm:w-auto max-sm:gap-2 max-sm:p-3">
          <div className="flex items-center justify-between border-b border-blue-950 pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-cyan-400" />
              <h3 className="font-display text-sm font-bold text-white">
                Zone Intelligence
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{results ? "ANALYSIS RESULTS" : "NO ANALYSIS"}</span>
          </div>

          {selectedLiveFeature && <div className="rounded-xl border border-rose-400/25 bg-rose-950/25 p-3 text-xs">
            <div className="mb-2 flex items-start justify-between gap-2"><strong className="text-white">{selectedLiveFeature.name}</strong><button type="button" aria-label="Close selected site record" onClick={()=>setSelectedLiveFeature(null)} className="text-slate-400 hover:text-white"><X size={14}/></button></div>
            <p className="text-rose-200">{selectedLiveFeature.category === "mining" ? "Mapped mine / quarry" : "Protected area / nature reserve"}</p><p className="mt-1 text-slate-300">{selectedLiveFeature.lat.toFixed(5)}, {selectedLiveFeature.lon.toFixed(5)}</p>
            {selectedRegion && <p className="mt-1 text-slate-300">{[selectedRegion.address.city,selectedRegion.address.county,selectedRegion.address.state,selectedRegion.address.country].filter(Boolean).join(" · ")}</p>}
            <p className="mt-2 text-slate-400">OpenStreetMap record. A mapped feature alone does not confirm recent activity.</p>
            <div className="mt-3 flex gap-2"><a href={selectedLiveFeature.source_url} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center rounded-lg border border-white/15 px-2 py-2 text-slate-200 transition-all hover:border-emerald-300/60 hover:shadow-[0_0_18px_rgba(34,197,94,.18)]">Source</a><button type="button" onClick={downloadLiveRecord} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-2 py-2 font-semibold text-white transition-all hover:bg-emerald-600 hover:shadow-[0_0_20px_rgba(34,197,94,.35)]"><Download size={14}/>Document</button></div>
          </div>}

          {activeLocation && (
            <div className="space-y-2 text-xs font-mono">
              <p className="text-white font-bold">{activeLocation.name}</p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {activeLocation.description}
              </p>
              <div className="rounded-lg bg-[#071329] p-3 border border-blue-950 space-y-1.5 mt-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Reference Centroid</span>
                  <span className="text-cyan-300">
                    {activeLocation.latitude.toFixed(4)}°{activeLocation.latitude >= 0 ? "N" : "S"}, {activeLocation.longitude.toFixed(4)}°{activeLocation.longitude >= 0 ? "E" : "W"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Change Detected</span>
                  <span className="text-white font-bold">{results ? `${results.total_area_ha} ha` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Average Confidence</span>
                  <span className="text-emerald-400">{results ? `${results.avg_confidence}%` : "—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Detections List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            <span className="text-[11px] font-mono text-slate-400 block mb-1">
              DETECTED CHANGE ANOMALIES:
            </span>
            {results?.detections && results.detections.length > 0 ? (
              results.detections.map((d, idx) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => setSelectedDetection(d)}
                  className={`w-full rounded-lg border p-2.5 text-left text-xs font-mono transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${
                    selectedDetection?.id === d.id
                      ? "border-cyan-400 bg-blue-950/80 shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                      : "border-blue-900/40 bg-[#071329] hover:border-blue-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white">Region #{idx + 1}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        d.change_type === "Deforestation"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : d.change_type === "Mining"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {d.change_type}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{d.area_hectares.toFixed(4)} ha</span>
                    <span className="text-emerald-400 font-bold">{d.confidence.toFixed(1)}% conf</span>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-xs text-slate-500 font-mono">No active detections for this zone.</p>
            )}
            {selectedDetection && <div className="rounded-xl border border-cyan-300/20 bg-[#071a20]/80 p-3">
              <p className="text-xs font-semibold text-cyan-100">Before / after imagery</p><div className="mt-2 grid grid-cols-2 gap-2">{([["Before", evidenceImages.before],["After", evidenceImages.after]] as const).map(([label,src])=><div key={label} className="overflow-hidden rounded-lg border border-white/10 bg-black/25"><span className="block px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</span>{src ? <Image src={src} alt={`${label} satellite scene`} width={220} height={120} unoptimized className="h-20 w-full object-cover"/> : <div className="flex h-20 items-center justify-center text-[10px] text-slate-500">No imagery</div>}</div>)}</div>
              <p className="mt-2 text-[10px] text-slate-400">{selectedDetection.change_type} · {selectedDetection.area_hectares.toFixed(2)} ha · {selectedDetection.confidence.toFixed(1)}% confidence</p>
              {results?.report_pdf_path && <a href={api.getReportDownloadUrl(results.scan_id)} className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-cyan-400/25 px-3 py-2 text-xs text-cyan-100 transition-all hover:border-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,.24)]"><Download size={14}/>Download analysis PDF</a>}
            </div>}
          </div>
        </div>

        {/* Bottom Coordinate & Measurement Strip */}
        <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none text-xs font-mono">
          <div className="pointer-events-auto rounded-lg border border-blue-900/60 bg-[#060E20]/90 px-3 py-1.5 text-cyan-300 flex items-center gap-2 backdrop-blur-md">
            <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
            {selectedDetection ? <span>DETECTION: {selectedDetection.centroid_lat.toFixed(4)}°, {selectedDetection.centroid_lon.toFixed(4)}°</span> : activeLocation && <span>LOCATION: {activeLocation.latitude.toFixed(4)}°, {activeLocation.longitude.toFixed(4)}°</span>}
          </div>

          <div className="pointer-events-auto rounded-lg border border-blue-900/60 bg-[#060E20]/90 px-3 py-1.5 text-slate-400 backdrop-blur-md">
            <span>{results ? "MAPBOX SATELLITE · ANALYSIS LAYERS" : "MAPBOX SATELLITE VIEW"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
