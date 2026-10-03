"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from "recharts";

export interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: {
    value: number;
    /** true = good news (green), false = bad news (red) */
    isPositive?: boolean;
  };
  icon: React.ComponentType<{ className?: string }>;
  /** One of: "teal" | "orange" | "red" | "blue" | "purple" */
  accent?: "teal" | "orange" | "red" | "blue" | "purple";
  sparklineData?: number[];
  animationDelay?: number;
}

const ACCENT: Record<
  NonNullable<KPICardProps["accent"]>,
  {
    icon: string;
    iconBg: string;
    sparkColor: string;
    sparkGrad1: string;
    sparkGrad2: string;
    glow: string;
    text: string;
  }
> = {
  teal: {
    icon: "text-[#00D284]",
    iconBg: "bg-[#00D284]/10 border-[#00D284]/20",
    sparkColor: "#00D284",
    sparkGrad1: "rgba(0,210,132,0.28)",
    sparkGrad2: "rgba(0,210,132,0)",
    glow: "glow-teal",
    text: "text-[#00D284]",
  },
  orange: {
    icon: "text-[#F79009]",
    iconBg: "bg-[#F79009]/10 border-[#F79009]/20",
    sparkColor: "#F79009",
    sparkGrad1: "rgba(247,144,9,0.28)",
    sparkGrad2: "rgba(247,144,9,0)",
    glow: "glow-orange",
    text: "text-[#F79009]",
  },
  red: {
    icon: "text-[#FF4D4D]",
    iconBg: "bg-[#FF4D4D]/10 border-[#FF4D4D]/20",
    sparkColor: "#FF4D4D",
    sparkGrad1: "rgba(255,77,77,0.28)",
    sparkGrad2: "rgba(255,77,77,0)",
    glow: "glow-red",
    text: "text-[#FF4D4D]",
  },
  blue: {
    icon: "text-[#00B4D8]",
    iconBg: "bg-[#00B4D8]/10 border-[#00B4D8]/20",
    sparkColor: "#00B4D8",
    sparkGrad1: "rgba(0,180,216,0.28)",
    sparkGrad2: "rgba(0,180,216,0)",
    glow: "glow-blue",
    text: "text-[#00B4D8]",
  },
  purple: {
    icon: "text-[#6366F1]",
    iconBg: "bg-[#6366F1]/10 border-[#6366F1]/20",
    sparkColor: "#6366F1",
    sparkGrad1: "rgba(99,102,241,0.28)",
    sparkGrad2: "rgba(99,102,241,0)",
    glow: "",
    text: "text-[#6366F1]",
  },
};

/** Shapes flat numbers into [{v}] objects for Recharts */
function toSeries(data: number[]) {
  return data.map((v) => ({ v }));
}

export default function KPICard({
  title,
  value,
  unit,
  change,
  icon: Icon,
  accent = "teal",
  sparklineData,
  animationDelay = 0,
}: KPICardProps) {
  const a = ACCENT[accent];

  const gradId = `spark-grad-${accent}`;

  return (
    <div
      className="kpi-slide-in relative overflow-hidden rounded-xl border border-white/[.07] bg-[#101E2E] p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[.12]"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Subtle top-edge glow line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${a.sparkColor}55, transparent)`,
        }}
      />

      {/* Ambient glow blob */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[.07] blur-3xl"
        style={{ background: a.sparkColor }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${a.iconBg}`}
        >
          <Icon className={`h-5 w-5 ${a.icon}`} />
        </div>

        {/* Mini sparkline top-right */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="h-10 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={toSeries(sparklineData)}
                margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
              >
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={a.sparkColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={a.sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={() => null}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={a.sparkColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradId})`}
                  dot={false}
                  isAnimationActive
                  animationDuration={1400}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Metric */}
      <div className="mt-3">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
          {title}
        </p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[26px] font-bold leading-none tracking-tight text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-slate-400">{unit}</span>
          )}
        </div>
      </div>

      {/* Trend badge */}
      {change && (
        <div className="mt-3 flex items-center gap-1.5">
          {change.isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          )}
          <span
            className={`text-[11px] font-medium ${
              change.isPositive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {change.isPositive ? "+" : "−"}
            {Math.abs(change.value)}% vs. last period
          </span>
        </div>
      )}
    </div>
  );
}
