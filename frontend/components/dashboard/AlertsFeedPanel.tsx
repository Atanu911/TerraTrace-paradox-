"use client";

import Link from "next/link";
import {
  TreePine,
  HardHat,
  Building2,
  ChevronRight,
  Activity,
  AlertTriangle,
} from "lucide-react";import type { AlertItem } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface ActivityEntry {
  id: string | number;
  color: "teal" | "yellow" | "cyan" | "blue" | "red";
  label: string;
  time: string;
}

interface AlertsFeedPanelProps {
  alerts?: AlertItem[];
  activity?: ActivityEntry[];
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const CHANGE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Deforestation: TreePine,
  Mining:        HardHat,
  Construction:  Building2,
};

const CHANGE_COLOR: Record<string, string> = {
  Deforestation: "text-[#00C49F] bg-[#00C49F]/10 border-[#00C49F]/25",
  Mining:        "text-[#F79009] bg-[#F79009]/10 border-[#F79009]/25",
  Construction:  "text-[#FF4D4D] bg-[#FF4D4D]/10 border-[#FF4D4D]/25",
};

const DOT_COLOR: Record<ActivityEntry["color"], string> = {
  teal:   "bg-[#00D284] shadow-[0_0_8px_rgba(0,210,132,0.7)]",
  yellow: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
  cyan:   "bg-[#00B4D8] shadow-[0_0_8px_rgba(0,180,216,0.7)]",
  blue:   "bg-blue-500 shadow-[0_0_8px_rgba(99,102,241,0.7)]",
  red:    "bg-[#FF4D4D] shadow-[0_0_8px_rgba(255,77,77,0.7)]",
};



const DEMO_ALERTS: AlertItem[] = [
  { id: 1, location_id: 1, location_name: "Kalimantan, Indonesia", rule_type: "area_threshold", threshold_ha: 50, change_type_filter: "Deforestation", status: "triggered", notification_method: "email", triggered_at: new Date(Date.now() - 7_200_000).toISOString(), created_at: new Date(Date.now() - 86_400_000).toISOString() },
  { id: 2, location_id: 2, location_name: "Amazon Basin, Brazil",  rule_type: "area_threshold", threshold_ha: 80, change_type_filter: "Mining",        status: "active",    notification_method: "email", created_at: new Date(Date.now() - 172_800_000).toISOString() },
  { id: 3, location_id: 3, location_name: "Sumatra, Indonesia",    rule_type: "area_threshold", threshold_ha: 30, change_type_filter: "Construction",  status: "triggered", notification_method: "sms",   triggered_at: new Date(Date.now() - 18_000_000).toISOString(), created_at: new Date(Date.now() - 259_200_000).toISOString() },
];

const DEMO_ACTIVITY: ActivityEntry[] = [
  { id: 1, color: "teal",   label: "New satellite image processed — Amazon, Brazil",         time: "10 min ago" },
  { id: 2, color: "yellow", label: "Change detected — deforestation in West Kalimantan",     time: "2 hours ago" },
  { id: 3, color: "cyan",   label: "Alert resolved — Central Kalimantan monitoring zone",    time: "4 hours ago" },
  { id: 4, color: "blue",   label: "Model update deployed — Global baseline recalibrated",   time: "1 day ago" },
];

function timeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function AlertsFeedPanel({
  alerts,
  activity,
  className = "",
}: AlertsFeedPanelProps) {
  const displayAlerts   = (alerts   && alerts.length   > 0) ? alerts.slice(0, 4)   : DEMO_ALERTS;
  const displayActivity = (activity && activity.length > 0) ? activity.slice(0, 5) : DEMO_ACTIVITY;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>

      {/* ── Recent Alerts ── */}
      <div className="rounded-xl border border-[#1D2D42] bg-[#101E2E] p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span className="text-sm font-semibold text-white">Recent Alerts</span>
            {displayAlerts.filter(a => a.status === "triggered").length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500/20 px-1.5 text-[10px] font-bold text-rose-400 border border-rose-400/30">
                {displayAlerts.filter(a => a.status === "triggered").length}
              </span>
            )}
          </div>
          <Link
            href="/alerts"
            className="flex items-center gap-0.5 text-[11px] text-[#00D284] transition-colors hover:text-white"
          >
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="space-y-0.5">
          {displayAlerts.map((alert) => {
            const Icon = CHANGE_ICON[alert.change_type_filter] ?? AlertTriangle;
            const colorCls = CHANGE_COLOR[alert.change_type_filter] ?? "text-slate-400 bg-white/5 border-white/10";
            const isTriggered = alert.status === "triggered";

            return (
              <div
                key={alert.id}
                className="alert-card-hover flex items-center gap-3 rounded-lg border border-transparent px-2 py-2.5"
              >
                {/* Icon badge */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colorCls}`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-100">
                    {alert.change_type_filter} — {alert.location_name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {alert.threshold_ha} ha threshold
                    {alert.triggered_at ? ` · ${timeAgo(alert.triggered_at)}` : ""}
                  </p>
                </div>

                {/* Status dot */}
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    isTriggered
                      ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
                      : "bg-amber-400"
                  }`}
                />
              </div>
            );
          })}

          {displayAlerts.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-500">
              No active alerts. Configure monitoring rules to get notified.
            </p>
          )}
        </div>
      </div>

      {/* ── Latest Activity ── */}
      <div className="rounded-xl border border-[#1D2D42] bg-[#101E2E] p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)]">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Latest Activity</span>
        </div>

        <div className="space-y-0.5">
          {displayActivity.map((entry, i) => {
            const isLast = i === displayActivity.length - 1;

            return (
              <div key={entry.id} className="relative flex gap-3 pb-3">
                {/* Vertical connector line */}
                {!isLast && (
                  <div className="absolute left-[11px] top-6 bottom-0 w-px bg-white/[.07]" />
                )}

                {/* Dot */}
                <div className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  <span className={`absolute h-2 w-2 rounded-full ${DOT_COLOR[entry.color]}`} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug text-slate-300">{entry.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{entry.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
