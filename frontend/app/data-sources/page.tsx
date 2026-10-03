"use client";

import { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, CheckSquare, ChevronRight,
  Download, FileText, Flame, HardHat, Layers, Leaf, MapPin, Pickaxe,
  Search, Shield, Square, TreePine, TrendingDown, TrendingUp, X
} from "lucide-react";
import { api, type HotspotDetection, type HotspotItem } from "@/lib/api";
import LocationMapModal from "@/components/map/LocationMapModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const ACTIVITY_META: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  Deforestation: {
    label: "Deforestation",
    bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30",
    icon: <TreePine className="h-4 w-4" />,
  },
  Mining: {
    label: "Mining & Extraction",
    bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/30",
    icon: <Pickaxe className="h-4 w-4" />,
  },
  Construction: {
    label: "Illegal Construction",
    bg: "bg-rose-500/10", text: "text-rose-300", border: "border-rose-500/30",
    icon: <HardHat className="h-4 w-4" />,
  },
  Heatmap: {
    label: "Thermal Anomaly",
    bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/30",
    icon: <Flame className="h-4 w-4" />,
  },
  Other: {
    label: "Other Activity",
    bg: "bg-cyan-500/10", text: "text-cyan-300", border: "border-cyan-500/30",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

const formatArea = (ha: number) =>
  ha >= 100 ? `${(ha / 100).toFixed(1)} km²` : `${ha.toFixed(1)} ha`;

export default function DataSourcesPage() {
  const [hotspots, setHotspots] = useState<HotspotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HotspotItem | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState("all");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [comparePdfUrl, setComparePdfUrl] = useState<string | null>(null);
  const [mapModalHotspot, setMapModalHotspot] = useState<HotspotItem | null>(null);

  useEffect(() => {
    api.getHotspots()
      .then((data) => {
        setHotspots(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = hotspots.filter((h) => {
    const q = search.toLowerCase();
    const matchQ = !q || h.name.toLowerCase().includes(q) || h.state.toLowerCase().includes(q) || h.minerals.toLowerCase().includes(q);
    const matchF =
      activeFilter === "all" ||
      (activeFilter === "deforestation" && h.type_counts["Deforestation"]) ||
      (activeFilter === "mining" && h.type_counts["Mining"]) ||
      (activeFilter === "construction" && h.type_counts["Construction"]) ||
      (activeFilter === "heatmap" && h.type_counts["Heatmap"]);
    return matchQ && matchF;
  });

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openPdf = (hotspot: HotspotItem) => {
    setPdfUrl(`${API_BASE}/api/reports/location/${hotspot.id}/download`);
  };

  const openCompare = () => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : hotspots.slice(0, 6).map((h) => h.id);
    setComparePdfUrl(api.getCompareReportUrl(ids));
  };

  // Group detections by type for the selected hotspot
  const detectionsByType = selected
    ? selected.detections.reduce<Record<string, HotspotDetection[]>>((acc, d) => {
        if (!acc[d.change_type]) acc[d.change_type] = [];
        acc[d.change_type].push(d);
        return acc;
      }, {})
    : {};

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400" />
      </div>
    );
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "deforestation", label: "Deforestation" },
    { key: "mining", label: "Mining" },
    { key: "construction", label: "Construction" },
    { key: "heatmap", label: "Heatmap" },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── LEFT SIDEBAR ───────────────────────────────────────── */}
      <aside className="w-[300px] min-w-[280px] flex flex-col border-r border-white/[.07] bg-[#06101a]">
        {/* Sidebar Header */}
        <div className="px-4 py-4 border-b border-white/[.07]">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-rose-300" />
            <h2 className="text-sm font-bold text-white">Monitored Regions</h2>
          </div>
          <p className="text-[10px] text-slate-500">{hotspots.length} active surveillance zones</p>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search regions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Filter Pills */}
          <div className="mt-2 flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                  activeFilter === f.key
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Compare Actions */}
        <div className="px-4 py-2 border-b border-white/[.05] flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select to compare"}
          </span>
          <button
            onClick={openCompare}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-medium text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            <BarChart3 className="h-3 w-3" />
            {selectedIds.size > 0 ? "Compare PDF" : "Compare All"}
          </button>
        </div>

        {/* Region List */}
        <div className="overflow-y-auto flex-1">
          {filtered.map((h) => (
            <div
              key={h.id}
              onClick={() => setSelected(h)}
              className={`flex gap-3 px-4 py-3 cursor-pointer border-b border-white/[.04] transition ${
                selected?.id === h.id
                  ? "bg-emerald-500/10 border-l-2 border-l-emerald-500"
                  : "hover:bg-white/[.03]"
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => toggleSelect(h.id, e)}
                className="mt-0.5 shrink-0 text-slate-500 hover:text-emerald-400 transition"
              >
                {selectedIds.has(h.id)
                  ? <CheckSquare className="h-4 w-4 text-emerald-400" />
                  : <Square className="h-4 w-4" />
                }
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-xs font-semibold text-white leading-tight truncate">{h.name}</p>
                  <span className={`shrink-0 text-[9px] font-mono px-1 py-0.5 rounded ${
                    h.forest_trend.startsWith("-")
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}>
                    {h.forest_trend}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <p className="text-[10px] text-slate-500 truncate">{h.state}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMapModalHotspot(h); }}
                    className="shrink-0 flex items-center gap-0.5 text-[9px] text-cyan-400 hover:text-cyan-300 transition px-1.5 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20"
                    title="View on Map"
                  >
                    <MapPin className="h-2.5 w-2.5" /> Map
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(h.type_counts).map(([type, count]) => {
                    const meta = ACTIVITY_META[type] || ACTIVITY_META.Other;
                    return (
                      <span key={type} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] ${meta.bg} ${meta.text}`}>
                        {type[0]}·{count}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-10 text-center px-4">
              <p className="text-xs text-slate-500">No regions match your search</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN DETAIL PANEL ──────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {selected ? (
          <>
            {/* Region Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-300/80 mb-1">
                  <MapPin className="h-3 w-3" />
                  <span>{selected.state.toUpperCase()} · INDIA GEOSPATIAL INTELLIGENCE</span>
                </div>
                <h1 className="text-2xl font-bold text-white">{selected.name}</h1>
                <p className="text-sm text-slate-400 mt-1 max-w-2xl">{selected.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMapModalHotspot(selected)}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition"
                >
                  <MapPin className="h-4 w-4" /> View on Map
                </button>
                <button
                  onClick={() => openPdf(selected)}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  <FileText className="h-4 w-4" /> View PDF Report
                </button>
              </div>
            </div>

            {/* Metadata Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Affected Area", value: formatArea(selected.total_area_ha), icon: <Layers className="h-4 w-4 text-amber-300" /> },
                { label: "Avg Confidence", value: `${selected.avg_confidence.toFixed(1)}%`, icon: <Activity className="h-4 w-4 text-emerald-300" /> },
                { label: "ISFR Forest Trend", value: selected.forest_trend, icon: selected.forest_trend.startsWith("-") ? <TrendingDown className="h-4 w-4 text-rose-300" /> : <TrendingUp className="h-4 w-4 text-emerald-300" /> },
                { label: "Coordinates", value: `${selected.latitude.toFixed(3)}°N, ${selected.longitude.toFixed(3)}°E`, icon: <MapPin className="h-4 w-4 text-cyan-300" /> },
              ].map((card) => (
                <div key={card.label} className="rounded-xl border border-white/[.07] bg-[#07172a]/80 p-4">
                  <div className="flex items-center gap-2 mb-1">{card.icon}<p className="text-[10px] text-slate-500">{card.label}</p></div>
                  <p className="text-sm font-bold text-white">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Minerals */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Pickaxe className="h-4 w-4 text-amber-300" />
                <h3 className="text-sm font-semibold text-amber-300">Mineral Resources</h3>
              </div>
              <p className="text-sm text-slate-300">{selected.minerals}</p>
            </div>

            {/* Detections by Type */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-rose-300" /> Malicious Activity Breakdown
              </h2>

              {Object.entries(detectionsByType).map(([type, dets]) => {
                const meta = ACTIVITY_META[type] || ACTIVITY_META.Other;
                const totalHa = dets.reduce((s, d) => s + d.area_hectares, 0);
                const avgConf = dets.reduce((s, d) => s + d.confidence, 0) / dets.length;
                return (
                  <div key={type} className={`rounded-xl border ${meta.border} ${meta.bg} p-5`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className={meta.text}>{meta.icon}</span>
                        <h3 className={`text-sm font-bold ${meta.text}`}>{meta.label}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{dets.length} detection{dets.length !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{formatArea(totalHa)} affected</span>
                        <span>·</span>
                        <span>{avgConf.toFixed(1)}% confidence</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {dets.map((d, idx) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-mono ${meta.text}`}>#{String(idx + 1).padStart(2, "0")}</span>
                            <div>
                              <p className="text-xs text-white">
                                {d.centroid_lat.toFixed(4)}°N, {d.centroid_lon.toFixed(4)}°E
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">Area: {formatArea(d.area_hectares)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs font-bold ${meta.text}`}>{d.confidence.toFixed(1)}%</div>
                            <div className="text-[10px] text-slate-500">confidence</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ISFR Forest Data */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Leaf className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-emerald-300">ISFR 2023 Forest Cover Data</h3>
                <span className="text-[10px] text-slate-500 ml-auto">Source: India State of Forest Report 2023</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500">5-Year Forest Cover Change</p>
                  <p className={`text-xl font-bold mt-1 ${selected.forest_trend.startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>
                    {selected.forest_trend}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">State</p>
                  <p className="text-sm font-bold text-white mt-1">{selected.state}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                {selected.description}
              </p>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            <p>Select a region from the sidebar to view its data.</p>
          </div>
        )}
      </main>

      {/* PDF Modal — Single Region */}
      {pdfUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#06151f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
              <div>
                <h3 className="font-semibold text-white">Forensic Report — {selected?.name}</h3>
                <p className="text-xs text-slate-400">Generated by TerraTrace Geospatial Intelligence Engine</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={pdfUrl} download className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button onClick={() => setPdfUrl(null)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white">
              <iframe src={pdfUrl} className="h-full w-full border-0" title="Forensic Report" />
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal — Compare */}
      {comparePdfUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#06151f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
              <div>
                <h3 className="font-semibold text-white">Multi-Region Comparative Report</h3>
                <p className="text-xs text-slate-400">
                  {selectedIds.size > 0 ? `${selectedIds.size} regions` : "All regions"} · TerraTrace AI
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a href={comparePdfUrl} download className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 transition">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button onClick={() => setComparePdfUrl(null)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white">
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

      {/* Task 4 Fullscreen Google Maps Modal */}
      {mapModalHotspot && (
        <LocationMapModal
          hotspot={mapModalHotspot}
          onClose={() => setMapModalHotspot(null)}
          onViewReport={() => {
            const h = mapModalHotspot;
            setMapModalHotspot(null);
            openPdf(h);
          }}
        />
      )}
    </div>
  );
}
