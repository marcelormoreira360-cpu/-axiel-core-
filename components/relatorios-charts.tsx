"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useClinicCurrency } from "@/components/currency-provider";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart,
} from "recharts";
import type {
  ReportTimeSeries, MonthlyPoint,
  MethodBreakdown, ServiceBreakdownItem, SourceBreakdownItem,
} from "@/services/report-service";

// ── Formatters (moeda da clínica) ─────────────────────────────────────────────

function fmtBRL(cents: number, currency: string, locale: string) {
  try {
    return (cents / 100).toLocaleString(locale, { style: "currency", currency });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function fmtBRLShort(cents: number, currency: string, locale: string) {
  try {
    return (cents / 100).toLocaleString(locale, {
      style: "currency", currency, maximumFractionDigits: cents / 100 >= 1000 ? 1 : 0,
      ...(cents / 100 >= 1000 ? { notation: "compact" as const } : {}),
    });
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency}`;
  }
}

// ── ProgressBar (used for breakdowns) ────────────────────────────────────────

function ProgressBar({
  label, value, max, sub, color = "#0F6E56",
}: {
  label: string; value: number; max: number; sub: string; color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-[4px]">
        <span className="text-[12px] text-[#0F1A2E] font-medium truncate max-w-[60%]">{label}</span>
        <span className="text-[11px] text-[#A09E98]">{sub}</span>
      </div>
      <div className="h-[6px] bg-[#F4F3EF] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px]">
      <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[14px]">
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Main chart: Revenue bars + Sessions line ─────────────────────────────────

function MainChart({ data }: { data: MonthlyPoint[] }) {
  const t = useTranslations("reports.charts");
  const currency = useClinicCurrency();
  const locale = useLocale();
  const maxRevenue = Math.max(...data.map((d) => d.revenue_cents), 1);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F4F3EF" vertical={false} />
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
          tickFormatter={(v) => fmtBRLShort(v as number, currency, locale)}
          width={52}
          domain={[0, maxRevenue * 1.15]}
        />
        <YAxis
          yAxisId="sessions"
          orientation="right"
          tick={{ fontSize: 10, fill: "#A09E98" }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 8,
            fontSize: 11,
            color: "#0F1A2E",
          }}
          formatter={(value, name) => {
            if (name === "revenue_cents") return [fmtBRL(value as number, currency, locale), t("tooltipRevenue")];
            if (name === "sessions") return [value, t("tooltipSessions")];
            return [value, name];
          }}
          labelFormatter={(label) => {
            const d = data.find((p) => p.label === label);
            return d?.fullLabel ?? label;
          }}
        />
        <Bar
          yAxisId="revenue"
          dataKey="revenue_cents"
          fill="#0F6E56"
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          opacity={0.85}
        />
        <Line
          yAxisId="sessions"
          type="monotone"
          dataKey="sessions"
          stroke="#2A7BC1"
          strokeWidth={2}
          dot={{ r: 3, fill: "#2A7BC1", stroke: "#fff", strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── New patients chart ────────────────────────────────────────────────────────

function NewPatientsChart({ data }: { data: MonthlyPoint[] }) {
  const t = useTranslations("reports.charts");
  const hasData = data.some((d) => d.new_patients > 0);
  if (!hasData) {
    return (
      <p className="text-[12px] text-[#D3D1C7] text-center py-6">
        {t("emptyNewPatients")}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F4F3EF" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#A09E98" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#A09E98" }}
          axisLine={false}
          tickLine={false}
          width={22}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 8,
            fontSize: 11,
            color: "#0F1A2E",
          }}
          formatter={(v) => [v, t("tooltipNewPatients")]}
          labelFormatter={(label) => {
            const d = data.find((p) => p.label === label);
            return d?.fullLabel ?? label;
          }}
        />
        <Bar
          dataKey="new_patients"
          fill="#7B5EA7"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Breakdown sections ────────────────────────────────────────────────────────

function PaymentMethodSection({ methods }: { methods: MethodBreakdown[] }) {
  const t = useTranslations("reports.charts");
  const currency = useClinicCurrency();
  const locale = useLocale();
  if (methods.length === 0) {
    return <p className="text-[12px] text-[#D3D1C7]">{t("emptyPayments")}</p>;
  }
  const maxVal = methods[0].amount_cents;
  return (
    <div className="space-y-[10px]">
      {methods.map((m) => (
        <ProgressBar
          key={m.label}
          label={m.label}
          value={m.amount_cents}
          max={maxVal}
          sub={`${fmtBRL(m.amount_cents, currency, locale)} · ${m.count}x`}
          color="#0F6E56"
        />
      ))}
    </div>
  );
}

function ServicesSection({ services }: { services: ServiceBreakdownItem[] }) {
  const t = useTranslations("reports.charts");
  if (services.length === 0) {
    return <p className="text-[12px] text-[#D3D1C7]">{t("emptySessions")}</p>;
  }
  const maxSessions = services[0].sessions;
  return (
    <div className="space-y-[10px]">
      {services.map((s) => (
        <ProgressBar
          key={s.name}
          label={s.name}
          value={s.sessions}
          max={maxSessions}
          sub={t("sessionsCount", { count: s.sessions })}
          color="#2A7BC1"
        />
      ))}
    </div>
  );
}

function SourcesSection({ sources }: { sources: SourceBreakdownItem[] }) {
  const t = useTranslations("reports.charts");
  if (sources.length === 0) {
    return <p className="text-[12px] text-[#D3D1C7]">{t("emptySources")}</p>;
  }
  const maxCount = sources[0].count;
  return (
    <div className="space-y-[10px]">
      {sources.map((s) => (
        <ProgressBar
          key={s.source}
          label={s.source}
          value={s.count}
          max={maxCount}
          sub={t("appointmentsCount", { count: s.count })}
          color="#E8A100"
        />
      ))}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

type Period = 3 | 6 | 12;

export function RelatoriosCharts({ data }: { data: ReportTimeSeries }) {
  const t = useTranslations("reports.charts");
  const currency = useClinicCurrency();
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>(6);

  const sliced = data.monthly.slice(-period);

  const totalRevenue  = sliced.reduce((s, d) => s + d.revenue_cents, 0);
  const totalSessions = sliced.reduce((s, d) => s + d.sessions, 0);
  const totalPatients = sliced.reduce((s, d) => s + d.new_patients, 0);

  const PERIODS: { label: string; value: Period }[] = [
    { label: t("periodMonths", { count: 3 }),  value: 3  },
    { label: t("periodMonths", { count: 6 }),  value: 6  },
    { label: t("periodMonths", { count: 12 }), value: 12 },
  ];

  return (
    <div className="space-y-[14px]">
      {/* Period selector + totals */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-[5px]">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={[
                "text-[11px] font-medium px-[12px] py-[5px] rounded-[7px] border transition",
                period === p.value
                  ? "bg-[#0F1A2E] border-[#0F1A2E] text-white"
                  : "bg-white border-black/[.08] text-[#6B6A66] hover:bg-[#F4F3EF]",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-[14px] text-[11px] text-[#A09E98]">
          <span><span className="font-semibold text-[#0F6E56]">{fmtBRL(totalRevenue, currency, locale)}</span> {t("totalsRevenue")}</span>
          <span><span className="font-semibold text-[#2A7BC1]">{totalSessions}</span> {t("totalsSessions")}</span>
          <span><span className="font-semibold text-[#7B5EA7]">{totalPatients}</span> {t("totalsNewPatients")}</span>
        </div>
      </div>

      {/* Main chart */}
      <Section title={t("mainChartTitle")}>
        <div className="flex items-center gap-4 mb-3">
          <span className="flex items-center gap-[5px] text-[10px] text-[#A09E98]">
            <span className="inline-block w-3 h-[10px] rounded-[2px] bg-[#0F6E56] opacity-85" /> {t("legendRevenue")}
          </span>
          <span className="flex items-center gap-[5px] text-[10px] text-[#A09E98]">
            <span className="inline-block w-3 h-px bg-[#2A7BC1]" /> {t("legendSessions")}
          </span>
        </div>
        <MainChart data={sliced} />
      </Section>

      {/* New patients */}
      <Section title={t("newPatientsTitle")}>
        <NewPatientsChart data={sliced} />
      </Section>

      {/* Breakdowns grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
        <Section title={t("paymentMethodsTitle")}>
          <PaymentMethodSection methods={data.paymentMethods} />
        </Section>
        <Section title={t("sessionTypesTitle")}>
          <ServicesSection services={data.services} />
        </Section>
        <Section title={t("sourcesTitle")}>
          <SourcesSection sources={data.sources} />
        </Section>
      </div>
    </div>
  );
}
