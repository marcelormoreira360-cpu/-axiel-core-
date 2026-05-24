"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { NpsTrendPoint } from "@/modules/analytics/analytics-kpis";

interface NpsTrendChartProps {
  data: NpsTrendPoint[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: NpsTrendPoint }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (point.count === 0) return null;
  return (
    <div className="bg-white border border-black/[.08] rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[#0F1A2E] mb-0.5">{label}</p>
      <p className="text-black/60">Média: <span className="font-semibold text-[#0F6E56]">{point.score.toFixed(1)}</span></p>
      <p className="text-black/40">{point.count} avaliação{point.count !== 1 ? "ões" : ""}</p>
    </div>
  );
}

export function NpsTrendChart({ data }: NpsTrendChartProps) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[140px] text-sm text-black/30">
        Sem avaliações ainda
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="npsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#0F6E56" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#0F6E56" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.35)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 10, fill: "rgba(0,0,0,0.35)" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#0F6E56"
          strokeWidth={2}
          fill="url(#npsGrad)"
          dot={{ r: 3, fill: "#0F6E56", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#0F6E56" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
