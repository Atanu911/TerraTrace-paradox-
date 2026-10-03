"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

/** Fallback demo data — replaced with real backend data when passed via props */
const DEMO_DATA = [
  { month: "May", deforestation: 8.2,  mining: 3.1, construction: 2.4 },
  { month: "Jun", deforestation: 10.4, mining: 3.8, construction: 3.1 },
  { month: "Jul", deforestation: 13.1, mining: 5.2, construction: 3.8 },
  { month: "Aug", deforestation: 11.7, mining: 4.9, construction: 4.2 },
  { month: "Sep", deforestation: 9.3,  mining: 4.1, construction: 3.6 },
  { month: "Oct", deforestation: 7.8,  mining: 3.5, construction: 2.9 },
  { month: "Nov", deforestation: 6.4,  mining: 2.8, construction: 2.1 },
  { month: "Dec", deforestation: 5.9,  mining: 2.5, construction: 1.8 },
  { month: "Jan", deforestation: 7.2,  mining: 3.0, construction: 2.3 },
  { month: "Feb", deforestation: 9.6,  mining: 3.7, construction: 3.2 },
  { month: "Mar", deforestation: 11.2, mining: 4.4, construction: 3.9 },
  { month: "Apr", deforestation: 12.6, mining: 5.1, construction: 4.7 },
];

export interface TrendDataPoint {
  month: string;
  deforestation: number;
  mining: number;
  construction: number;
}

interface LandUseTrendsChartProps {
  data?: TrendDataPoint[];
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#101E2E]/95 px-3 py-2.5 shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs capitalize text-slate-300">{p.name}</span>
          <span className="ml-auto pl-4 text-xs font-semibold text-white">{p.value.toFixed(1)} km²</span>
        </div>
      ))}
    </div>
  );
}

const LEGEND_ITEMS = [
  { key: "deforestation", label: "Deforestation", color: "#00C49F" },
  { key: "mining",        label: "Mining",        color: "#F79009" },
  { key: "construction",  label: "Construction",  color: "#FF4D4D" },
];

function CustomLegend() {
  return (
    <div className="flex items-center gap-4 px-1 pt-3">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
          <span className="text-[11px] text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function LandUseTrendsChart({ data, className = "" }: LandUseTrendsChartProps) {
  const chartData = data ?? DEMO_DATA;

  return (
    <div className={`rounded-xl border border-[#1D2D42] bg-[#101E2E] p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Land Use Change</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Last 12 months · km²</p>
        </div>
        <span className="rounded-full border border-[#1D2D42] bg-[#16273B] px-2.5 py-1 text-[10px] font-medium text-slate-400">
          Apr 2024 – Apr 2025
        </span>
      </div>

      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-deforestation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#00C49F" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#00C49F" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-mining" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#F79009" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#F79009" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-construction" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#FF4D4D" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#FF4D4D" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              ticks={MONTHS}
            />
            <YAxis
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
              ticks={[0, 5, 10, 15]}
              domain={[0, 15]}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            />

            <Area
              type="monotoneX"
              dataKey="deforestation"
              name="deforestation"
              stroke="#00C49F"
              strokeWidth={2}
              fill="url(#grad-deforestation)"
              dot={false}
              activeDot={{ r: 4, fill: "#00C49F", strokeWidth: 0 }}
              isAnimationActive
              animationDuration={1200}
              animationEasing="ease-out"
            />
            <Area
              type="monotoneX"
              dataKey="mining"
              name="mining"
              stroke="#F79009"
              strokeWidth={2}
              fill="url(#grad-mining)"
              dot={false}
              activeDot={{ r: 4, fill: "#F79009", strokeWidth: 0 }}
              isAnimationActive
              animationDuration={1400}
              animationEasing="ease-out"
            />
            <Area
              type="monotoneX"
              dataKey="construction"
              name="construction"
              stroke="#FF4D4D"
              strokeWidth={2}
              fill="url(#grad-construction)"
              dot={false}
              activeDot={{ r: 4, fill: "#FF4D4D", strokeWidth: 0 }}
              isAnimationActive
              animationDuration={1600}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <CustomLegend />
    </div>
  );
}
