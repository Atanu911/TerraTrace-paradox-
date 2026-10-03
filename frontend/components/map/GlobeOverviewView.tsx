"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowUpRight, BellRing, CalendarDays, ChevronRight,
  CircleDot, Clock3, Download, FileText, Filter, Flame, HardHat, Layers,
  Leaf, MapPin, Pickaxe, Radar, Search, TreePine, X, CheckSquare, Square,
  BarChart3, Shield
} from "lucide-react";
import { api, type AlertItem, type DashboardStats, type HotspotItem, type ScanItem, type LocationItem } from "@/lib/api";
import Photorealistic3DGlobe from "@/components/map/Photorealistic3DGlobe";
import LocationMapModal from "@/components/map/LocationMapModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const ACTIVITY_COLORS: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  Deforestation: {
    bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30",
    icon: <TreePine className="h-3.5 w-3.5" />,
  },
  Mining: {
    bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30",
    icon: <Pickaxe className="h-3.5 w-3.5" />,
  },
  Construction: {
    bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/30",
    icon: <HardHat className="h-3.5 w-3.5" />,
  },
  Heatmap: {
    bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/30",
    icon: <Flame className="h-3.5 w-3.5" />,
  },
  Other: {
    bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/30",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

const formatArea = (ha: number) =>
  ha >= 100 ? `${(ha / 100).toFixed(1)} km²` : `${ha.toFixed(1)} ha`;

export default function GlobeOverviewView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotItem | null>(null);
  const [mapModalHotspot, setMapModalHotspot] = useState<HotspotItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [comparePdfUrl, setComparePdfUrl] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const [statsR, hotspotsR, alertsR, scansR] = await Promise.allSettled([
      api.getStats(),
      api.getHotspots(),
      api.getAlerts(),
      api.getScans(),
    ]);
    if (statsR.status === "fulfilled") setStats(statsR.value);
    if (hotspotsR.status === "fulfilled") setHotspots(hotspotsR.value);
    if (alertsR.status === "fulfilled") setAlerts(alertsR.value);
    if (scansR.status === "fulfilled") setScans(scansR.value);
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    const t = window.setTimeout(refresh, 0);
    const p = window.setInterval(refresh, 30_000);
    return () => { window.clearTimeout(t); window.clearInterval(p); };
  }, [refresh]);

  const activeAlerts = alerts.filter((a) => a.status === "triggered" || a.status === "active");

  const filteredHotspots = hotspots.filter((h) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      h.name.toLowerCase().includes(q) ||
      h.state.toLowerCase().includes(q) ||
      h.minerals.toLowerCase().includes(q) ||
      h.description.toLowerCase().includes(q);
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "deforestation" && h.type_counts["Deforestation"]) ||
      (activeFilter === "mining" && h.type_counts["Mining"]) ||
      (activeFilter === "construction" && h.type_counts["Construction"]) ||
      (activeFilter === "heatmap" && h.type_counts["Heatmap"]);
    return matchesSearch && matchesFilter;
  });

  // Map locations shape for the 3D globe (memoized to prevent teardown of WebGL context)
  const mapLocations: LocationItem[] = useMemo(() => {
    return filteredHotspots.map((h) => ({
      id: h.id,
      name: h.name,
      latitude: h.latitude,
      longitude: h.longitude,
      description: h.description,
      created_at: "",
      scan_count: h.detections.length,
      latest_scan_status: "completed" as const,
    }));
  }, [filteredHotspots]);

  const handleSelectGlobeLocation = useCallback((loc: LocationItem) => {
    const h = hotspots.find((x) => x.id === loc.id);
    if (h) {
      setSelectedHotspot(h);
      setMapModalHotspot(h);
    }
  }, [hotspots]);

  const openHotspotReport = async (hotspot: HotspotItem) => {
    setSelectedHotspot(hotspot);
    // Open the fullscreen map modal first — PDF available from within
    setMapModalHotspot(hotspot);
  };

  const openPdfFromModal = (hotspot: HotspotItem) => {
    setMapModalHotspot(null);
    setSelectedHotspot(hotspot);
    const url = `${API_BASE}/api/reports/location/${hotspot.id}/download`;
    setSelectedPdfUrl(url);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCompareReport = () => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : hotspots.slice(0, 6).map((h) => h.id);
    setComparePdfUrl(api.getCompareReportUrl(ids));
  };

  const filters = [
    { key: "all", label: "All Regions" },
    { key: "deforestation", label: "Deforestation" },
    { key: "mining", label: "Mining" },
    { key: "construction", label: "Construction" },
    { key: "heatmap", label: "Heatmap" },
  ];

  return (
    <div className="globe-overview-view min-h-screen px-4 pb-12 pt-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-6">

        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              TerraTrace / India Malicious Activity Monitor
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Hot Regions Map
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              {hotspots.length} active monitoring zones · India Mineral Map + ISFR 2023 data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <Clock3 className="h-3.5 w-3.5" />
              {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting…"}
            </span>
            <button
              onClick={openCompareReport}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <BarChart3 className="h-4 w-4" />
              {selectedIds.size > 0 ? `Compare ${selectedIds.size} Regions` : "Compare All"}
            </button>
            <Link
              href="/analyze"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#042018] shadow-[0_8px_28px_rgba(16,185,129,.18)] transition hover:bg-emerald-300"
            >
              <Radar className="h-4 w-4" /> New comparison
            </Link>
          </div>
        </header>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Monitored Zones", value: hotspots.length, color: "text-emerald-300" },
            { label: "Total Detections", value: stats?.total_detections ?? "—", color: "text-amber-300" },
            { label: "Area Affected", value: stats ? formatArea(stats.total_changed_area_ha) : "—", color: "text-rose-300" },
            { label: "Avg Confidence", value: stats ? `${stats.avg_confidence.toFixed(1)}%` : "—", color: "text-cyan-300" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/[.07] bg-[#06151f]/80 px-4 py-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.color}`}>{String(s.value)}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Globe */}
          <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#06151f]/90 shadow-[0_24px_80px_rgba(0,0,0,.2)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-300" />
                  <h2 className="text-sm font-semibold text-white">Interactive 3D Satellite Earth Globe</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Photorealistic 3D globe · {filteredHotspots.length} hot regions shown
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search regions, minerals, states..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-64 rounded-md border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none transition focus:border-emerald-500/50 focus:bg-white/10"
                  />
                </div>
                <Link href="/dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/10 px-3 text-xs text-slate-300 transition hover:border-emerald-300/30 hover:text-white">
                  Dashboard <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            <div className="relative min-h-[500px] sm:min-h-[580px] w-full p-2">
              <Photorealistic3DGlobe
                locations={mapLocations}
                scans={scans}
                onSelectLocation={handleSelectGlobeLocation}
              />
            </div>
          </section>

          {/* Right Panel: Hotspot List */}
          <aside className="flex flex-col gap-4">
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activeFilter === f.key
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                      : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Hotspot List */}
            <section className="flex-1 rounded-2xl border border-white/[.08] bg-[#071722]/90 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-rose-300" />
                  <h2 className="text-sm font-semibold text-white">Malicious Activity Hotspots</h2>
                </div>
                <span className="text-xs text-slate-500">{filteredHotspots.length} sites</span>
              </div>

              <div className="overflow-y-auto max-h-[560px] divide-y divide-white/[.05]">
                {filteredHotspots.map((hotspot) => (
                  <div
                    key={hotspot.id}
                    className="group flex gap-3 px-4 py-3 hover:bg-white/[.035] transition cursor-pointer"
                    onClick={() => openHotspotReport(hotspot)}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(hotspot.id); }}
                      className="mt-0.5 shrink-0 text-slate-500 hover:text-emerald-400 transition"
                    >
                      {selectedIds.has(hotspot.id)
                        ? <CheckSquare className="h-4 w-4 text-emerald-400" />
                        : <Square className="h-4 w-4" />
                      }
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-white leading-snug">{hotspot.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{hotspot.state} · {hotspot.minerals}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          hotspot.forest_trend.startsWith("-")
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                            : hotspot.forest_trend.startsWith("+")
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-slate-500/10 border-slate-500/30 text-slate-400"
                        }`}>
                          ISFR {hotspot.forest_trend}
                        </span>
                      </div>

                      {/* Activity Type Pills */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(hotspot.type_counts).map(([type, count]) => {
                          const colors = ACTIVITY_COLORS[type] || ACTIVITY_COLORS.Other;
                          return (
                            <span
                              key={type}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text} ${colors.border}`}
                            >
                              {colors.icon}
                              {type} ({count})
                            </span>
                          );
                        })}
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                          {formatArea(hotspot.total_area_ha)} · {hotspot.avg_confidence.toFixed(1)}% conf
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMapModalHotspot(hotspot);
                            }}
                            className="inline-flex items-center gap-1 rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/20 transition"
                            title="Open Fullscreen Satellite Map"
                          >
                            <MapPin className="h-2.5 w-2.5" /> Map
                          </button>
                          <span className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Report
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredHotspots.length === 0 && (
                  <div className="py-10 text-center">
                    <p className="text-sm text-slate-500">No regions match your search</p>
                  </div>
                )}
              </div>
            </section>

            {/* Alerts */}
            <section className="rounded-2xl border border-white/[.08] bg-[#071722]/90 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-rose-300" />
                  <h2 className="text-sm font-semibold text-white">Recent alerts</h2>
                </div>
                <Link href="/alerts" className="text-xs text-emerald-300 hover:text-white">
                  View all <ChevronRight className="inline h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-1">
                {activeAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="flex gap-3 border-b border-white/[.055] py-2 last:border-0">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.status === "triggered" ? "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,.7)]" : "bg-amber-300"}`} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-100">{alert.location_name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{alert.change_type_filter} · threshold {alert.threshold_ha} ha</p>
                    </div>
                  </div>
                ))}
                {!activeAlerts.length && (
                  <p className="py-3 text-xs text-slate-500">No active alerts.</p>
                )}
              </div>
            </section>
          </aside>
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-[#071722]/55 px-4 py-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-2">
            <Leaf className="h-3.5 w-3.5 text-emerald-400" />
            Detections are change candidates from ISFR 2023 &amp; India Mineral Map data. Verify findings against source imagery.
          </span>
          <span>Changed area · {formatArea(stats?.total_changed_area_ha ?? 0)}</span>
        </footer>
      </div>

      {/* Map Modal */}
      {mapModalHotspot && (
        <LocationMapModal
          hotspot={mapModalHotspot}
          onClose={() => setMapModalHotspot(null)}
          onViewReport={() => openPdfFromModal(mapModalHotspot)}
        />
      )}

      {/* Single Location PDF Modal */}
      {selectedPdfUrl && selectedHotspot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6">
          <div className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#06151f] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
              <div>
                <h3 className="font-semibold text-white">{selectedHotspot.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedHotspot.state} · ISFR Trend: {selectedHotspot.forest_trend}</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={selectedPdfUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
                <button
                  onClick={() => { setSelectedPdfUrl(null); setSelectedHotspot(null); }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Activity Summary */}
            <div className="border-b border-white/[.07] px-5 py-3 flex flex-wrap gap-3">
              {Object.entries(selectedHotspot.type_counts).map(([type, count]) => {
                const colors = ACTIVITY_COLORS[type] || ACTIVITY_COLORS.Other;
                const areaForType = selectedHotspot.detections
                  .filter((d) => d.change_type === type)
                  .reduce((sum, d) => sum + d.area_hectares, 0);
                return (
                  <div key={type} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${colors.bg} ${colors.border}`}>
                    <span className={colors.text}>{colors.icon}</span>
                    <div>
                      <p className={`text-xs font-semibold ${colors.text}`}>{type}</p>
                      <p className="text-[10px] text-slate-500">{count} detection{count !== 1 ? "s" : ""} · {formatArea(areaForType)}</p>
                    </div>
                  </div>
                );
              })}
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                <span>Total: <strong className="text-white">{formatArea(selectedHotspot.total_area_ha)}</strong></span>
                <span>·</span>
                <span>Avg conf: <strong className="text-white">{selectedHotspot.avg_confidence.toFixed(1)}%</strong></span>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-white">
              {loadingPdf ? (
                <div className="flex h-full items-center justify-center bg-[#06151f]">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400" />
                </div>
              ) : (
                <iframe src={selectedPdfUrl} className="h-full w-full border-0" title="Forensic Report" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compare Report PDF Modal */}
      {comparePdfUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6">
          <div className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#06151f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
              <div>
                <h3 className="font-semibold text-white">Multi-Region Comparative Forensic Report</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedIds.size > 0 ? `${selectedIds.size} regions selected` : "All regions"} · Generated by TerraTrace AI
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={comparePdfUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 transition"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
                <button
                  onClick={() => setComparePdfUrl(null)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white">
              <iframe src={comparePdfUrl} className="h-full w-full border-0" title="Comparative Report" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
