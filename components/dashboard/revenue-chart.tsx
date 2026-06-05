"use client";

import { useTranslations, useLocale } from "next-intl";
import { useClinicCurrency } from "@/components/currency-provider";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { RevenuePoint } from "@/modules/dashboard/dashboard-charts";

interface Props {
  data: RevenuePoint[];
}

// Formata na moeda da clínica; usa notação compacta para valores grandes (eixo/header).
function fmtMoney(cents: number, currency: string, locale: string) {
  const big = cents >= 100000;
  try {
    return (cents / 100).toLocaleString(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      ...(big ? { notation: "compact" as const } : {}),
    });
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency}`;
  }
}

function makeTooltip(labels: { revenue: string; sessions: string }, fmt: (c: number) => string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const revenue = payload.find((p: { dataKey: string }) => p.dataKey === "revenue")?.value ?? 0;
    const sessions = payload.find((p: { dataKey: string }) => p.dataKey === "sessions")?.value ?? 0;
    return (
      <div className="bg-white border border-black/[.08] rounded-[10px] shadow-lg px-[13px] py-[10px] text-[12px]">
        <p className="font-medium text-[#0F1A2E] mb-[6px]">{label}</p>
        <div className="flex items-center gap-2 mb-[3px]">
          <span className="w-2 h-2 rounded-full bg-[#0F6E56]" />
          <span className="text-[#6B6A66]">{labels.revenue}:</span>
          <span className="font-semibold text-[#0F1A2E]">{fmt(revenue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2D8CFF]/70" />
          <span className="text-[#6B6A66]">{labels.sessions}:</span>
          <span className="font-semibold text-[#0F1A2E]">{sessions}</span>
        </div>
      </div>
    );
  };
}

export function RevenueChart({ data }: Props) {
  const t = useTranslations("dashboard.chart");
  const locale = useLocale();
  const currency = useClinicCurrency();
  const fmt = (c: number) => fmtMoney(c, currency, locale);
  const CustomTooltip = makeTooltip({ revenue: t("revenue"), sessions: t("sessions") }, fmt);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalSessions = data.reduce((s, d) => s + d.sessions, 0);
  const hasData = totalRevenue > 0 || totalSessions > 0;

  return (
    <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] p-[16px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-[14px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[2px]">
            {t("title", { count: data.length })}
          </p>
          <p className="text-[20px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">
            {fmt(totalRevenue)}
          </p>
        </div>
        <div className="flex items-center gap-[14px] text-[11px] text-[#A09E98] mt-[4px]">
          <span className="flex items-center gap-[5px]">
            <span className="w-[10px] h-[3px] rounded-full bg-[#0F6E56]" />
            {t("revenue")}
          </span>
          <span className="flex items-center gap-[5px]">
            <span className="w-[10px] h-[3px] rounded-full bg-[#2D8CFF]/70" />
            {t("sessionsWithCount", { count: totalSessions })}
          </span>
        </div>
      </div>

      {/* Chart */}
      {hasData ? (
        <ResponsiveContainer width="100%" height={170}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0F6E56" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0F6E56" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F0EFE9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#A09E98" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="revenue"
              orientation="left"
              tick={{ fontSize: 10, fill: "#A09E98" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmt(v)}
            />
            <YAxis
              yAxisId="sessions"
              orientation="right"
              tick={{ fontSize: 10, fill: "#A09E98" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F4F3EF", radius: 4 }} />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="#0F6E56"
              strokeWidth={2}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#0F6E56" }}
            />
            <Bar
              yAxisId="sessions"
              dataKey="sessions"
              fill="#2D8CFF"
              fillOpacity={0.25}
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[170px] flex items-center justify-center">
          <p className="text-[12px] text-[#C5C3BC]">{t("empty")}</p>
        </div>
      )}
    </div>
  );
}
