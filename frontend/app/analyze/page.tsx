"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  UploadCloud, Play, Download, Eye, ExternalLink, Search,
  Brain, FileText, Flame, HardHat, Loader2, MapPin,
  Pickaxe, RefreshCw, Sparkles, TreePine, X, ChevronDown,
  AlertTriangle, ArrowLeftRight, Clock, CheckCircle2
} from "lucide-react";
import { api, type HotspotItem, type AIReportResponse, type LocationItem, type AnalysisResults, type ScanItem } from "@/lib/api";
import ComparisonViewer from "@/components/analysis/ComparisonViewer";
import LocationMapModal from "@/components/map/LocationMapModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const YEAR_OPTIONS = [2020, 2021, 2022, 2023, 2024, 2025];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  Deforestation: <TreePine className="h-4 w-4" />,
  Mining: <Pickaxe className="h-4 w-4" />,
  Construction: <HardHat className="h-4 w-4" />,
  Heatmap: <Flame className="h-4 w-4" />,
  Other: <AlertTriangle className="h-4 w-4" />,
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

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400 font-mono">Loading Change Detection Suite...</div>}>
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const initialScanId = searchParams.get("scan_id");
  const initialLocationId = searchParams.get("location_id");

  // Hotspot / region selection
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotItem | null>(null);
  const [regionSearch, setRegionSearch] = useState("");
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [beforeYear, setBeforeYear] = useState(2020);
  const [afterYear, setAfterYear] = useState(2025);

  // AI Report
  const [aiReport, setAiReport] = useState<AIReportResponse | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Legacy upload flow
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<number>(1);
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [droneFile, setDroneFile] = useState<File | null>(null);
  const [currentScanId, setCurrentScanId] = useState<number | null>(
    initialScanId ? parseInt(initialScanId) : null
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<string>("idle");
  const [pipelineProgress, setPipelineProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusError, setStatusError] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [currentScan, setCurrentScan] = useState<ScanItem | null>(null);
  const [selectedDetectionId, setSelectedDetectionId] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(0.25);
  const [minArea, setMinArea] = useState(50);
  const pollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadResults = useCallback(async (id: number) => {
    try {
      const [res, scans] = await Promise.all([api.getAnalysisResults(id), api.getScans()]);
      setResults(res);
      setCurrentScanId(id);
      setSelectedLocation(res.location_id);
      const matched = scans.find((s) => s.id === id) ?? null;
      setCurrentScan(matched);
      setStatusError(false);
      return res;
    } catch (error) {
      setStatusError(true);
      setStatusMessage(error instanceof Error ? error.message : "Failed to load scan results.");
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Load hotspots
    api.getHotspots().then((data) => {
      if (!active) return;
      setHotspots(data);
      // Auto-select if location_id param provided
      if (initialLocationId) {
        const h = data.find((x) => x.id === parseInt(initialLocationId));
        if (h) setSelectedHotspot(h);
      }
    }).catch(console.error);

    // Load legacy locations
    api.getLocations().then((locs) => {
      if (!active) return;
      setLocations(locs);
      if (!initialLocationId && locs.length > 0) setSelectedLocation(locs[0].id);
    }).catch(console.error);

    // Auto-load scan if scan_id provided
    const timer = initialScanId && parseInt(initialScanId) > 0
      ? window.setTimeout(() => { void loadResults(parseInt(initialScanId)); }, 0)
      : null;

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      if (pollingTimer.current) clearInterval(pollingTimer.current);
    };
  }, [initialLocationId, initialScanId, loadResults]);

  const handleStartAnalysis = async () => {
    try {
      setAnalyzing(true);
      setResults(null);
      setStatusError(false);
      setPipelineStep("uploading");
      setPipelineProgress(0.1);
      setStatusMessage("Uploading and validating multi-temporal rasters...");

      let scanId = currentScanId;

      if (oldFile && newFile) {
        const formData = new FormData();
        formData.append("location_id", selectedLocation.toString());
        formData.append("old_image", oldFile);
        formData.append("new_image", newFile);
        if (droneFile) formData.append("drone_image", droneFile);
        formData.append("gsd_meters", "0.5");
        const uploadRes = await api.uploadScan(formData);
        scanId = uploadRes.scan_id;
        setCurrentScanId(scanId);
      } else if (!scanId) {
        throw new Error("Upload both comparison images or select a region first.");
      }
      if (!scanId) throw new Error("No scan available to analyze.");

      setPipelineStep("dispatching");
      setPipelineProgress(0.2);
      setStatusMessage("Dispatching change-forensics pipeline...");

      await api.startAnalysis(scanId, { change_threshold: threshold, min_region_area_px: minArea });

      if (pollingTimer.current) clearInterval(pollingTimer.current);
      pollingTimer.current = setInterval(async () => {
        try {
          const status = await api.getAnalysisStatus(scanId!);
          setPipelineStep(status.current_step || "processing");
          setPipelineProgress(status.progress || 0.3);
          if (status.status === "completed") {
            if (pollingTimer.current) clearInterval(pollingTimer.current);
            pollingTimer.current = null;
            setAnalyzing(false);
            setPipelineProgress(1.0);
            setStatusMessage("Forensic change detection successfully concluded.");
            await loadResults(scanId!);
          } else if (status.status === "failed") {
            if (pollingTimer.current) clearInterval(pollingTimer.current);
            pollingTimer.current = null;
            setAnalyzing(false);
            setStatusError(true);
            setStatusMessage(`Analysis failed: ${status.error_message || "Unknown error"}`);
          }
        } catch (error) {
          if (pollingTimer.current) clearInterval(pollingTimer.current);
          pollingTimer.current = null;
          setAnalyzing(false);
          setStatusError(true);
          setStatusMessage(error instanceof Error ? error.message : "Lost connection.");
        }
      }, 1000);
    } catch (error) {
      if (pollingTimer.current) clearInterval(pollingTimer.current);
      pollingTimer.current = null;
      setAnalyzing(false);
      setStatusError(true);
      setStatusMessage(error instanceof Error ? error.message : "Failed to execute analysis.");
    }
  };

  const generateAIReport = async () => {
    if (!selectedHotspot) {
      setReportError("Please select a region first.");
      return;
    }
    setGeneratingReport(true);
    setReportError("");
    setAiReport(null);

    try {
      const report = await api.generateAIChangeReport({
        location_id: selectedHotspot.id,
        location_name: selectedHotspot.name,
        state: selectedHotspot.state,
        minerals: selectedHotspot.minerals,
        forest_trend: selectedHotspot.forest_trend,
        total_area_ha: selectedHotspot.total_area_ha,
        avg_confidence: selectedHotspot.avg_confidence,
        detections: selectedHotspot.detections,
        years: afterYear - beforeYear,
      });
      setAiReport(report);
      // Also set PDF url for this location
      if (selectedHotspot.scan_id) {
        setPdfUrl(`${API_BASE}/api/reports/location/${selectedHotspot.id}/download`);
      }
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "AI report generation failed.");
    } finally {
      setGeneratingReport(false);
    }
  };

  // For region search dropdown
  const filteredHotspots = hotspots.filter((h) =>
    !regionSearch ||
    h.name.toLowerCase().includes(regionSearch.toLowerCase()) ||
    h.state.toLowerCase().includes(regionSearch.toLowerCase())
  );

  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRegionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-load scan results when a hotspot is selected
  useEffect(() => {
    if (selectedHotspot?.scan_id && selectedHotspot.scan_id !== currentScanId) {
      loadResults(selectedHotspot.scan_id);
    }
  }, [selectedHotspot, currentScanId, loadResults]);

  // Get scan for selected hotspot to load legacy comparison viewer
  const hotspotScan = currentScan || null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-900/40 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>CHANGE DETECTION · AI FORENSICS ENGINE</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Satellite Change Detection
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Select a monitored region, compare 5-year satellite imagery, and generate an AI forensic report.
          </p>
        </div>
      </div>

      {/* ── SECTION 1: Region Selector + Year Range ── */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#06101a]/80 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">Select Monitoring Area</h2>
        </div>
        <p className="text-xs text-slate-400">Choose from 18 monitored regions across India's mineral and forest surveillance zones.</p>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          {/* Region Searchable Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowRegionDropdown(!showRegionDropdown)}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:border-cyan-500/30 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {selectedHotspot ? selectedHotspot.name : "Select a region..."}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${showRegionDropdown ? "rotate-180" : ""}`} />
            </button>

            {showRegionDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-white/10 bg-[#06101a] shadow-2xl overflow-hidden">
                <div className="p-2 border-b border-white/[.06]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search region, state, minerals..."
                      value={regionSearch}
                      onChange={(e) => setRegionSearch(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/50"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredHotspots.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => { setSelectedHotspot(h); setShowRegionDropdown(false); setRegionSearch(""); setAiReport(null); setPdfUrl(null); }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[.04] transition border-b border-white/[.04] last:border-0 ${selectedHotspot?.id === h.id ? "bg-cyan-500/10" : ""}`}
                    >
                      <MapPin className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{h.name}</p>
                        <p className="text-[10px] text-slate-500">{h.state} · {h.minerals}</p>
                      </div>
                      <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded ${h.forest_trend.startsWith("-") ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                        {h.forest_trend}
                      </span>
                    </button>
                  ))}
                  {filteredHotspots.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-500">No regions found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Before Year */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">Before (Year)</span>
            <select
              value={beforeYear}
              onChange={(e) => setBeforeYear(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-[#071522] px-3 py-3 text-sm text-white"
            >
              {YEAR_OPTIONS.filter((y) => y < afterYear).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          {/* After Year */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">After (Year)</span>
            <select
              value={afterYear}
              onChange={(e) => setAfterYear(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-[#071522] px-3 py-3 text-sm text-white"
            >
              {YEAR_OPTIONS.filter((y) => y > beforeYear).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Selected Region Info */}
        {selectedHotspot && (
          <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4 flex flex-wrap gap-4">
            <div>
              <p className="text-[10px] text-slate-500">Region</p>
              <p className="text-sm font-bold text-white mt-0.5">{selectedHotspot.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">State</p>
              <p className="text-sm font-bold text-white mt-0.5">{selectedHotspot.state}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Minerals</p>
              <p className="text-sm font-bold text-white mt-0.5">{selectedHotspot.minerals}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">ISFR Forest Trend</p>
              <p className={`text-sm font-bold mt-0.5 ${selectedHotspot.forest_trend.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>
                {selectedHotspot.forest_trend}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Total Area Affected</p>
              <p className="text-sm font-bold text-amber-300 mt-0.5">{formatArea(selectedHotspot.total_area_ha)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Detections</p>
              <p className="text-sm font-bold text-white mt-0.5">{selectedHotspot.detections.length}</p>
            </div>
            <div className="ml-auto flex items-center">
              <button
                onClick={() => setShowMapModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition"
              >
                <MapPin className="h-3.5 w-3.5" /> View on Map
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── SECTION 2: Side-by-Side Comparison ── */}
      {selectedHotspot && (
        <section className="rounded-2xl border border-white/[.07] bg-[#06101a]/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Satellite Image Comparison</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMapModal(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20 transition"
              >
                <MapPin className="h-3 w-3" /> View on Satellite Map
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{beforeYear} vs {afterYear} ({afterYear - beforeYear} years)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Before */}
            <div className="rounded-xl overflow-hidden border border-white/[.07]">
              <div className="bg-white/5 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">BEFORE — {beforeYear}</span>
                <span className="text-[10px] text-slate-500">Satellite imagery</span>
              </div>
              <div className="relative aspect-video bg-[#07172a] flex items-center justify-center">
                {hotspotScan?.old_thumbnail ? (
                  <img
                    src={`${API_BASE}${hotspotScan.old_thumbnail}`}
                    alt={`Before ${beforeYear}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                      <TreePine className="h-8 w-8 text-emerald-500/40" />
                    </div>
                    <p className="text-xs text-slate-500">Before imagery</p>
                    <p className="text-[10px] text-slate-600 mt-1">{beforeYear}</p>
                  </div>
                )}
              </div>
            </div>

            {/* After */}
            <div className="rounded-xl overflow-hidden border border-white/[.07]">
              <div className="bg-white/5 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">AFTER — {afterYear}</span>
                <span className="text-[10px] text-slate-500">Change detected</span>
              </div>
              <div className="relative aspect-video bg-[#07172a] flex items-center justify-center">
                {hotspotScan?.new_thumbnail ? (
                  <img
                    src={`${API_BASE}${hotspotScan.new_thumbnail}`}
                    alt={`After ${afterYear}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="h-8 w-8 text-rose-500/40" />
                    </div>
                    <p className="text-xs text-slate-500">After imagery</p>
                    <p className="text-[10px] text-slate-600 mt-1">{afterYear}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detection Summary Tiles */}
          <div className="flex flex-wrap gap-3 pt-2">
            {Object.entries(selectedHotspot.type_counts).map(([type, count]) => {
              const icon = ACTIVITY_ICONS[type] || ACTIVITY_ICONS.Other;
              const color = ACTIVITY_COLORS[type] || ACTIVITY_COLORS.Other;
              const areaForType = selectedHotspot.detections
                .filter((d) => d.change_type === type)
                .reduce((s, d) => s + d.area_hectares, 0);
              return (
                <div key={type} className="flex items-center gap-2 rounded-lg border border-white/[.07] bg-white/5 px-3 py-2">
                  <span className={color}>{icon}</span>
                  <div>
                    <p className={`text-xs font-semibold ${color}`}>{type}</p>
                    <p className="text-[10px] text-slate-500">{count} detect · {formatArea(areaForType)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load legacy comparison viewer if scan exists */}
          {results && hotspotScan && (
            <div className="mt-4 rounded-xl border border-white/[.07] overflow-hidden">
              <ComparisonViewer
                scan={hotspotScan}
                results={results}
                location={locations.find((l) => l.id === hotspotScan.location_id) ?? null}
                onDetectionSelect={setSelectedDetectionId}
                selectedDetectionId={selectedDetectionId}
              />
            </div>
          )}
        </section>
      )}

      {/* ── SECTION 3: AI Report Generator ── */}
      <section className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white">AI Forensic Analysis Report</h2>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-300">
              Powered by Cohere AI
            </span>
          </div>
          {pdfUrl && (
            <a
              href={pdfUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-500/20 transition"
            >
              <Download className="h-3.5 w-3.5" /> Download PDF Report
            </a>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Our AI model analyzes {afterYear - beforeYear > 0 ? `${afterYear - beforeYear}-year` : "multi-year"} satellite change detection data for the selected region and generates a comprehensive forensic assessment with threat classification, risk levels, and enforcement recommendations.
        </p>

        <button
          onClick={generateAIReport}
          disabled={!selectedHotspot || generatingReport}
          className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/15 px-5 py-3 text-sm font-semibold text-purple-200 hover:bg-purple-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingReport ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating AI Report...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Generate AI Forensic Report</>
          )}
        </button>

        {reportError && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
            {reportError}
          </p>
        )}

        {/* AI Report Output */}
        {aiReport && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Region", value: aiReport.location_name },
                { label: "Total Area", value: formatArea(aiReport.total_area_ha) },
                { label: "Avg Confidence", value: `${aiReport.avg_confidence.toFixed(1)}%` },
                { label: "Activity Types", value: Object.keys(aiReport.type_totals).length.toString() },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-purple-500/15 bg-purple-500/5 px-3 py-2">
                  <p className="text-[10px] text-slate-500">{s.label}</p>
                  <p className="text-sm font-bold text-white mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Type Totals */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(aiReport.type_totals).map(([type, ha]) => {
                const color = ACTIVITY_COLORS[type] || "text-cyan-300";
                return (
                  <div key={type} className={`flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs ${color}`}>
                    {ACTIVITY_ICONS[type]}
                    {type}: {formatArea(ha)}
                  </div>
                );
              })}
            </div>

            {/* Report Text */}
            <div className="rounded-xl border border-purple-500/20 bg-black/30 p-5">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[.05]">
                <FileText className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-semibold text-purple-300">AI-Generated Forensic Report</span>
                <span className="ml-auto text-[10px] text-slate-500">{new Date().toLocaleDateString()}</span>
              </div>
              <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                {aiReport.report_text}
              </pre>
            </div>

            {/* PDF & Geospatial Forensics Links (Task 4) */}
            <div className="rounded-xl border border-cyan-500/20 bg-[#071625]/90 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <p className="text-sm font-semibold text-cyan-300">Geospatial Forensics & Fullscreen Satellite Map</p>
                </div>
                <p className="text-xs text-slate-400">
                  Inspect {selectedHotspot?.name} ({selectedHotspot?.latitude.toFixed(4)}°N, {selectedHotspot?.longitude.toFixed(4)}°E) in fullscreen Google satellite view with terrain & 3D topography.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowMapModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:from-cyan-400 hover:to-blue-500 transition"
                >
                  <MapPin className="h-3.5 w-3.5" /> View on Fullscreen Map
                </button>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open PDF Report
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── SECTION 4: Upload Custom Images (Legacy) ── */}
      <section className="rounded-2xl border border-white/[.07] bg-[#06101a]/80 p-6">
        <div className="flex items-center gap-2 mb-4">
          <UploadCloud className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-bold text-white">Upload Custom Satellite Pairs</h2>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">Optional</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Upload your own before/after satellite or drone images to run the change detection pipeline.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Location */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">Monitoring Location</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-[#071522] px-3 py-2 text-sm text-white"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </label>

          {/* Before Image */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">Before Image</span>
            <div
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-4 text-xs text-slate-400 cursor-pointer hover:border-cyan-500/30 hover:text-white transition"
              onClick={() => document.getElementById("old-file-input")?.click()}
            >
              <UploadCloud className="h-4 w-4" />
              {oldFile ? oldFile.name : "Upload before image"}
            </div>
            <input id="old-file-input" type="file" accept="image/*" className="hidden" onChange={(e) => setOldFile(e.target.files?.[0] ?? null)} />
          </label>

          {/* After Image */}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">After Image</span>
            <div
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-4 text-xs text-slate-400 cursor-pointer hover:border-cyan-500/30 hover:text-white transition"
              onClick={() => document.getElementById("new-file-input")?.click()}
            >
              <UploadCloud className="h-4 w-4" />
              {newFile ? newFile.name : "Upload after image"}
            </div>
            <input id="new-file-input" type="file" accept="image/*" className="hidden" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {/* Pipeline Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">Change Threshold</span>
            <input type="number" min="0.05" max="0.95" step="0.05" value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-24 rounded-lg border border-white/10 bg-[#071522] px-3 py-1.5 text-sm text-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">Min Area (px)</span>
            <input type="number" min="10" max="1000" step="10" value={minArea}
              onChange={(e) => setMinArea(parseInt(e.target.value))}
              className="w-24 rounded-lg border border-white/10 bg-[#071522] px-3 py-1.5 text-sm text-white"
            />
          </label>
          <button
            onClick={handleStartAnalysis}
            disabled={analyzing || (!oldFile && !currentScanId)}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-[#042018] hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Running Pipeline...</> : <><Play className="h-4 w-4" /> Run Analysis</>}
          </button>
        </div>

        {/* Progress Bar */}
        {analyzing && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">{pipelineStep}</span>
              <span>{Math.round(pipelineProgress * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${pipelineProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {statusMessage && (
          <p className={`mt-3 rounded-lg border px-4 py-2 text-xs ${statusError ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
            {statusMessage}
          </p>
        )}

        {/* Results */}
        {results && currentScan && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Analysis Results</h3>
              </div>
              {results.report_pdf_path && (
                <a
                  href={`${API_BASE}${results.report_pdf_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  <Eye className="h-3.5 w-3.5" /> View PDF
                </a>
              )}
            </div>
            <ComparisonViewer
              scan={currentScan}
              results={results}
              location={locations.find((l) => l.id === currentScan.location_id) ?? null}
              onDetectionSelect={setSelectedDetectionId}
              selectedDetectionId={selectedDetectionId}
            />
          </div>
        )}
      </section>

      {/* Task 4 Fullscreen Google Maps Modal */}
      {showMapModal && selectedHotspot && (
        <LocationMapModal
          hotspot={selectedHotspot}
          onClose={() => setShowMapModal(false)}
          onViewReport={() => {
            setShowMapModal(false);
            if (selectedHotspot.scan_id) {
              setPdfUrl(`${API_BASE}/api/reports/location/${selectedHotspot.id}/download`);
            }
          }}
        />
      )}
    </div>
  );
}
