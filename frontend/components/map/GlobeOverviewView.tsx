"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, BellRing, CalendarDays, ChevronRight, CircleDot, Clock3, Leaf, Map, MapPin, Radar } from "lucide-react";
import { api, type AlertItem, type DashboardStats, type LocationItem, type ScanItem } from "@/lib/api";
import Photorealistic3DGlobe from "@/components/map/Photorealistic3DGlobe";

const formatArea = (ha: number) => ha >= 100 ? `${(ha / 100).toFixed(1)} km²` : `${ha.toFixed(1)} ha`;

interface GlobeOverviewViewProps {
  onSwitchToMap?: () => void;
}

export default function GlobeOverviewView({ onSwitchToMap }: GlobeOverviewViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const [statsResult, locationsResult, alertsResult, scansResult] = await Promise.allSettled([
      api.getStats(), api.getLocations(), api.getAlerts(), api.getScans(),
    ]);
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    if (locationsResult.status === "fulfilled") setLocations(locationsResult.value);
    if (alertsResult.status === "fulfilled") setAlerts(alertsResult.value);
    if (scansResult.status === "fulfilled") setScans(scansResult.value);
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    const poll = window.setInterval(refresh, 30_000);
    return () => { window.clearTimeout(first); window.clearInterval(poll); };
  }, [refresh]);

  const activeAlerts = alerts.filter((alert) => alert.status === "triggered" || alert.status === "active");
  const activity = [...scans].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4);

  return (
    <div className="globe-overview-view min-h-screen px-4 pb-12 pt-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> TerraTrace / Geospatial Intelligence
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Global change monitor</h1>
            <p className="mt-1.5 text-sm text-slate-400">Interactive 3D orthographic globe monitoring environmental detections and verified scan sites worldwide.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <Clock3 className="h-3.5 w-3.5" />
              {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting…"}
            </span>
            {onSwitchToMap && (
              <button
                type="button"
                onClick={onSwitchToMap}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-950/40 px-4 text-sm font-semibold text-cyan-200 shadow-[0_4px_20px_rgba(6,182,212,0.15)] transition hover:bg-cyan-900/50 hover:text-white"
              >
                <Map className="h-4 w-4" />
                <span>2D Satellite Map</span>
              </button>
            )}
            <Link href="/analyze" className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#042018] shadow-[0_8px_28px_rgba(16,185,129,.18)] transition hover:bg-emerald-300">
              <Radar className="h-4 w-4" /> New comparison
            </Link>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#06151f]/90 shadow-[0_24px_80px_rgba(0,0,0,.2)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-300" />
                  <h2 className="text-sm font-semibold text-white">Interactive 3D Satellite Earth Globe</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">Photorealistic 3D satellite globe & Google Earth telemetry targeting 22.14°N, 84.10°E.</p>
              </div>
              {onSwitchToMap ? (
                <button
                  type="button"
                  onClick={onSwitchToMap}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/10 px-3 text-xs text-slate-300 transition hover:border-emerald-300/30 hover:text-white"
                >
                  Inspect on 2D map <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Link href="/dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/10 px-3 text-xs text-slate-300 transition hover:border-emerald-300/30 hover:text-white">
                  Satellite view <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <div className="relative min-h-[500px] sm:min-h-[580px] w-full p-2">
              <Photorealistic3DGlobe locations={locations} scans={scans} />
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-white/[.08] bg-[#071722]/90 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-rose-300" />
                  <h2 className="text-sm font-semibold text-white">Recent alerts</h2>
                </div>
                <Link href="/alerts" className="text-xs text-emerald-300 hover:text-white">
                  View all <ChevronRight className="inline h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-1">
                {activeAlerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className="flex gap-3 border-b border-white/[.055] py-3 last:border-0">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.status === "triggered" ? "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,.7)]" : "bg-amber-300"}`} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-100">{alert.location_name}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{alert.change_type_filter} · threshold {alert.threshold_ha} ha</p>
                    </div>
                  </div>
                ))}
                {!activeAlerts.length && (
                  <p className="py-4 text-xs leading-relaxed text-slate-500">
                    No active alerts. Create a monitoring rule to get notified when a comparison exceeds a threshold.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/[.08] bg-[#071722]/90 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-300" />
                  <h2 className="text-sm font-semibold text-white">Latest scans</h2>
                </div>
                <span className="text-[10px] text-slate-500">{scans.length} total</span>
              </div>
              <div className="space-y-1">
                {activity.map((scan) => {
                  const location = locations.find((item) => item.id === scan.location_id);
                  const dotColor = scan.status === "completed" ? "text-emerald-300" : scan.status === "failed" ? "text-rose-300" : "text-sky-300";
                  return (
                    <Link key={scan.id} href={`/analyze?scan_id=${scan.id}`} className="group flex gap-3 rounded-lg px-2 py-3 transition hover:bg-white/[.035]">
                      <CircleDot className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${dotColor}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-slate-100">{location?.name ?? `Scan ${scan.id}`}</span>
                          <ChevronRight className="h-3 w-3 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-emerald-300" />
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                          <CalendarDays className="h-3 w-3" />{scan.scan_date_new || new Date(scan.created_at).toLocaleDateString()} · {scan.status}{scan.detection_count ? ` · ${scan.detection_count} candidates` : ""}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                {!activity.length && (
                  <div className="py-5 text-center">
                    <p className="text-xs text-slate-400">No image comparisons yet</p>
                    <Link href="/analyze" className="mt-2 inline-block text-xs text-emerald-300">Upload your first pair →</Link>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[.06] bg-[#071722]/55 px-4 py-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-2">
            <Leaf className="h-3.5 w-3.5 text-emerald-400" /> Detections are change candidates. Verify findings against source imagery.
          </span>
          <span>Changed area · {formatArea(stats?.total_changed_area_ha ?? 0)}</span>
        </footer>
      </div>
    </div>
  );
}
