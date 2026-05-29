"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthlyBreakdown } from "@/services/business-analytics-service";

function fmtBRLShort(cents: number) {
  const v = cents / 100;
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

interface Props {
  monthly: MonthlyBreakdown[];
}

export function ResultsChart({ monthly }: Props) {
  if (monthly.length === 0) return null;

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
      <p className="text-[12px] font-medium text-[#0F1A2E] mb-[14px]">
        Evolução mensal
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F4F3EF" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtBRLShort}
            width={52}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,.08)",
              boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            }}
            formatter={(value, name) => {
              if (name === "Receita") return [fmtBRLShort(Number(value)), name];
              return [value, name];
            }}
          />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Bar
            yAxisId="left"
            dataKey="sessions"
            name="Sessões"
            fill="#0F6E56"
            radius={[3, 3, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            yAxisId="left"
            dataKey="new_patients"
            name="Novos pacientes"
            fill="#C7D2FE"
            radius={[3, 3, 0, 0]}
            maxBarSize={36}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="revenue_cents"
            name="Receita"
            stroke="#4F46E5"
            strokeWidth={2}
            dot={{ r: 3, fill: "#4F46E5" }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
