"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { 
  UploadCloud, 
  Play, 
  Download, 
  Eye, 
  ExternalLink
} from "lucide-react";
import { api, LocationItem, AnalysisResults, ScanItem } from "@/lib/api";
import ComparisonViewer from "@/components/analysis/ComparisonViewer";

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400 font-mono">Loading Forensic Suite...</div>}>
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const initialScanId = searchParams.get("scan_id");
  const initialLocationId = searchParams.get("location_id");

  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<number>(1);
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [droneFile, setDroneFile] = useState<File | null>(null);

  // Analysis State
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
  const [referenceImagePath, setReferenceImagePath] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.25);
  const [minArea, setMinArea] = useState(50);
  const pollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadResults = useCallback(async (id: number) => {
    try {
      const [res, scans] = await Promise.all([api.getAnalysisResults(id), api.getScans()]);
      setResults(res);
      setCurrentScanId(id);
      setSelectedLocation(res.location_id);
      const matched = scans.find((scan) => scan.id === id) ?? null;
      setCurrentScan(matched);
      setReferenceImagePath(matched?.old_thumbnail ?? null);
      setStatusError(false);
      return res;
    } catch (error) {
      setStatusError(true);
      setStatusMessage(error instanceof Error ? error.message : "Failed to load scan results.");
      setReferenceImagePath(null);
      setCurrentScan(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const requestedLocationId = initialLocationId ? Number.parseInt(initialLocationId, 10) : null;
    const requestedScanId = initialScanId ? Number.parseInt(initialScanId, 10) : null;

    api.getLocations().then((locs) => {
      if (!active) return;
      setLocations(locs);
      if (initialLocationId) {
        if (locs.some((location) => location.id === requestedLocationId)) {
          setSelectedLocation(requestedLocationId!);
        } else {
          setStatusError(true);
          setStatusMessage("The requested monitoring location was not found.");
        }
      } else if (locs.length > 0) {
        setSelectedLocation(locs[0].id);
      }
    }).catch((error: unknown) => {
      if (!active) return;
      setStatusError(true);
      setStatusMessage(error instanceof Error ? error.message : "Could not load monitoring locations.");
    });

    const resultsTimer = requestedScanId && Number.isInteger(requestedScanId) && requestedScanId > 0
      ? window.setTimeout(() => { void loadResults(requestedScanId); }, 0)
      : null;
    return () => {
      active = false;
      if (resultsTimer !== null) window.clearTimeout(resultsTimer);
      if (pollingTimer.current) clearInterval(pollingTimer.current);
    };
  }, [initialLocationId, initialScanId, loadResults]);

  // Upload & start analysis
  const handleStartAnalysis = async () => {
    try {
      setAnalyzing(true);
      setResults(null);
      setStatusError(false);
      setPipelineStep("uploading");
      setPipelineProgress(0.1);
      setStatusMessage("Uploading and validating multi-temporal rasters...");

      let scanId = currentScanId;
      if (Boolean(oldFile) !== Boolean(newFile)) {
        throw new Error("Choose both the before and after images to start a new comparison.");
      }

      // If user uploaded new files, submit form data
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
        throw new Error("Upload both comparison images or choose a scan from the demo list first.");
      }

      if (!scanId) throw new Error("No scan is available to analyze.");

      // Start pipeline execution
      setPipelineStep("dispatching");
      setPipelineProgress(0.2);
      setStatusMessage("Dispatching computer vision pipeline...");

      await api.startAnalysis(scanId, {
        change_threshold: threshold,
        min_region_area_px: minArea,
      });

      // Poll status until completion
      if (pollingTimer.current) clearInterval(pollingTimer.current);
      pollingTimer.current = setInterval(async () => {
        try {
          const status = await api.getAnalysisStatus(scanId);
          setPipelineStep(status.current_step || "processing");
          setPipelineProgress(status.progress || 0.3);

          if (status.status === "completed") {
            if (pollingTimer.current) clearInterval(pollingTimer.current);
            pollingTimer.current = null;
            setAnalyzing(false);
            setPipelineProgress(1.0);
            setStatusMessage("Forensic change detection successfully concluded.");
            await loadResults(scanId);
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
          setStatusMessage(error instanceof Error ? error.message : "Lost connection while checking analysis progress.");
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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-900/40 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>TEMPORAL CHANGE FORENSICS ENGINE</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Run Satellite & Drone Investigation
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Upload pre- and post-incident passes or select an active monitoring target to isolate environmental changes.
          </p>
        </div>

        {results && (
          <div className="flex items-center gap-3">
            <a
              href={api.getReportDownloadUrl(results.scan_id)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-4 py-2 text-xs font-mono font-semibold text-emerald-300 hover:bg-emerald-900/60 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF Dossier</span>
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── LEFT CONFIG & UPLOAD PANEL ─────────────────── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-panel rounded-2xl p-6 border-blue-900/50">
            <div className="flex items-center gap-2 mb-4">
              <UploadCloud className="h-4 w-4 text-cyan-400" />
              <h2 className="font-display text-base font-bold text-white">
                Input Image Rasters
              </h2>
            </div>

            {/* Target Location Selection */}
            <div className="space-y-2 mb-4">
              <label className="text-xs font-mono text-slate-300">
                1. Target Location
              </label>
              <select
                value={selectedLocation || ""}
                onChange={(e) => setSelectedLocation(parseInt(e.target.value))}
                disabled={locations.length === 0 || analyzing}
                className="min-h-11 w-full rounded-lg border border-blue-900/80 bg-[#071329] px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none disabled:opacity-50"
              >
                {locations.length === 0 && <option value="">No monitoring locations available</option>}
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.latitude.toFixed(2)}°N, {loc.longitude.toFixed(2)}°E)
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Reference Image */}
            <div className="space-y-2 mb-3">
              <label className="text-xs font-mono text-emerald-400 flex items-center justify-between">
                <span>2. Reference Pass (Before)</span>
                {oldFile && <span className="text-[10px] text-emerald-300">{oldFile.name}</span>}
              </label>
              <div className="relative border border-dashed border-emerald-500/40 rounded-xl p-4 text-center bg-emerald-950/10 hover:bg-emerald-950/20 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { setOldFile(e.target.files?.[0] || null); setCurrentScanId(null); }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <p className="text-xs text-slate-300 font-mono">
                  {oldFile ? oldFile.name : "Drop pre-incident raster (PNG, JPG)"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Or leave blank to use synthesized baseline</p>
              </div>
            </div>

            {/* Upload New Image */}
            <div className="space-y-2 mb-4">
              <label className="text-xs font-mono text-red-400 flex items-center justify-between">
                <span>3. Incident Pass (After)</span>
                {newFile && <span className="text-[10px] text-red-300">{newFile.name}</span>}
              </label>
              <div className="relative border border-dashed border-red-500/40 rounded-xl p-4 text-center bg-red-950/10 hover:bg-red-950/20 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { setNewFile(e.target.files?.[0] || null); setCurrentScanId(null); }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <p className="text-xs text-slate-300 font-mono">
                  {newFile ? newFile.name : "Drop post-incident raster (PNG, JPG)"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Or leave blank to use synthesized test raster</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <label htmlFor="drone-context" className="text-xs font-mono text-cyan-300">Optional drone image</label>
              <input
                id="drone-context"
                type="file"
                accept="image/*"
                onChange={(event) => setDroneFile(event.target.files?.[0] || null)}
                className="block min-h-11 w-full text-xs text-slate-300 file:mr-3 file:min-h-10 file:rounded-md file:border file:border-cyan-400/30 file:bg-cyan-950/50 file:px-3 file:text-xs file:text-cyan-100 hover:file:bg-cyan-900/60"
              />
            </div>

            {/* Threshold Fine-tuning */}
            <div className="border-t border-blue-950 pt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Change Sensitivity</span>
                <span className="text-cyan-400">{threshold * 100}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />

              <div className="flex justify-between text-slate-300 pt-2">
                <span>Min Area Threshold</span>
                <span className="text-cyan-400">{minArea} px²</span>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                step="10"
                value={minArea}
                onChange={(e) => setMinArea(parseInt(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            {/* Run Button */}
            <button
              onClick={handleStartAnalysis}
              type="button"
              disabled={analyzing || (!currentScanId && (!oldFile || !newFile)) || locations.length === 0}
              className="mt-6 min-h-11 w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-gradient-to-r from-blue-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Executing Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Execute 5-Step Pipeline</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Demo Pre-sets */}
          <div className="glass-panel rounded-2xl p-5 border-blue-900/50 text-xs font-mono">
            <span className="text-slate-400 block mb-2">QUICK DEMO LOADERS:</span>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setCurrentScanId(1); void loadResults(1); }}
                aria-pressed={currentScanId === 1}
                className="text-left p-2.5 rounded-lg border border-blue-900/60 bg-[#071329] hover:border-cyan-400/50 text-slate-300 transition-all"
              >
                <span className="font-bold text-cyan-300 block">Sundarbans Biosphere (Scan #01)</span>
                <span className="text-[11px] text-slate-400">Deforestation & Unpermitted Building Pad</span>
              </button>
              <button
                type="button"
                onClick={() => { setCurrentScanId(2); void loadResults(2); }}
                aria-pressed={currentScanId === 2}
                className="text-left p-2.5 rounded-lg border border-blue-900/60 bg-[#071329] hover:border-cyan-400/50 text-slate-300 transition-all"
              >
                <span className="font-bold text-amber-300 block">Raniganj Coal Basin (Scan #02)</span>
                <span className="text-[11px] text-slate-400">Open-Cast Terraced Mining Pit Expansion</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT FORENSIC RESULTS PANEL ────────────────── */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Pipeline execution status bar */}
          {analyzing && (
            <div className="glass-panel rounded-2xl p-5 border-cyan-400/40 shadow-[0_0_25px_rgba(34,211,238,0.2)] font-mono text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                  <span className="font-bold text-white uppercase">Pipeline Stage: {pipelineStep}</span>
                </div>
                <span className="text-cyan-300">{(pipelineProgress * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-blue-950 h-2 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300"
                  style={{ width: `${pipelineProgress * 100}%` }}
                />
              </div>
              <p className="text-slate-300 text-[11px]">{statusMessage}</p>
            </div>
          )}

          {!analyzing && statusMessage && (
            <div role={statusError ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${statusError ? "border-red-400/30 bg-red-950/30 text-red-200" : "border-emerald-400/30 bg-emerald-950/20 text-emerald-200"}`}>
              {statusMessage}
            </div>
          )}

          {/* Reusable Before vs Latest Comparison Engine */}
          <ComparisonViewer
            scan={currentScan}
            results={results}
            location={locations.find((l) => l.id === selectedLocation) || null}
            selectedDetectionId={selectedDetectionId}
            onDetectionSelect={(id) => setSelectedDetectionId(id)}
          />

          {/* Detections List Table */}
          {results && results.detections && results.detections.length > 0 && (
            <div className="glass-panel rounded-2xl p-6 border-blue-900/50">
              <div className="flex items-center justify-between mb-4 font-mono">
                <h3 className="font-display text-sm font-bold text-white">
                  Polygonal Anomalies ({results.detections.length} Classified Regions)
                </h3>
                <span className="text-xs text-slate-400">
                  GSD: 0.5m / px
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-blue-950 text-slate-400">
                      <th className="pb-2.5">ID</th>
                      <th className="pb-2.5">CLASSIFICATION</th>
                      <th className="pb-2.5">AREA (HA)</th>
                      <th className="pb-2.5">PIXELS</th>
                      <th className="pb-2.5">CONFIDENCE</th>
                      <th className="pb-2.5">COORDINATES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-950/60">
                    {results.detections.map((det, index) => (
                      <tr
                        key={det.id}
                        onClick={() => setSelectedDetectionId((prev) => (prev === det.id ? null : det.id))}
                        className={`cursor-pointer transition-colors ${
                          selectedDetectionId === det.id
                            ? "bg-cyan-950/70 border-l-2 border-cyan-400 text-white"
                            : "hover:bg-blue-950/30"
                        }`}
                      >
                        <td className="py-2.5 font-bold text-cyan-300">
                          R{index + 1}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              det.change_type === "Deforestation"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : det.change_type === "Mining"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : "bg-red-500/20 text-red-300 border-red-500/30"
                            }`}
                          >
                            {det.change_type}
                          </span>
                        </td>
                        <td className="py-2.5 text-white font-semibold">
                          {det.area_hectares.toFixed(4)} ha
                        </td>
                        <td className="py-2.5 text-slate-400">
                          {det.area_pixels} px
                        </td>
                        <td className="py-2.5 text-emerald-400 font-bold">
                          {det.confidence.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-slate-300 font-mono text-[11px]">
                          {det.centroid_lat.toFixed(5)}°N, {det.centroid_lon.toFixed(5)}°E
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
