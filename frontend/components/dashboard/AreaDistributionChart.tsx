"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export interface AreaDistributionData {
  forest:       number; // percentage
  deforested:   number;
  mining:       number;
  construction: number;
  totalKm2?:    number;
}

interface AreaDistributionChartProps {
  data?: AreaDistributionData;
  className?: string;
}

const DEFAULTS: AreaDistributionData = {
  forest:       76.4,
  deforested:   12.8,
  mining:        6.1,
  construction:  4.7,
  totalKm2:   1248,
};

const SEGMENTS = [
  { key: "forest",       label: "Forest",       color: "#00C49F" },
  { key: "deforested",   label: "Deforested",   color: "#F79009" },
  { key: "mining",       label: "Mining",       color: "#FBBF24" },
  { key: "construction", label: "Construction", color: "#FF4D4D" },
] as const;

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-[#101E2E]/95 px-3 py-2 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: p.payload.color }} />
        <span className="text-xs text-slate-300">{p.name}</span>
        <span className="ml-2 text-xs font-semibold text-white">{Number(p.value).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function AreaDistributionChart({ data, className = "" }: AreaDistributionChartProps) {
  const d = data ?? DEFAULTS;

  const chartData = SEGMENTS.map((s) => ({
    name:  s.label,
    value: d[s.key],
    color: s.color,
  }));

  return (
    <div className={`rounded-xl border border-[#1D2D42] bg-[#101E2E] p-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] ${className}`}>
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Area Distribution</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Monitored zone breakdown</p>
        </div>
        <span className="rounded-full border border-[#1D2D42] bg-[#16273B] px-2.5 py-1 text-[10px] font-medium text-slate-400">
          Live
        </span>
      </div>

      {/* Donut + center label */}
      <div className="relative flex items-center justify-center" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive
              animationBegin={200}
              animationDuration={1200}
              animationEasing="ease-out"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-bold leading-none tracking-tight text-white">
            {(d.totalKm2 ?? 1248).toLocaleString()}
          </span>
          <span className="mt-1 text-[11px] font-medium text-slate-400">km² total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {SEGMENTS.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="truncate text-[11px] text-slate-400">{s.label}</span>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-white">
              {d[s.key].toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
