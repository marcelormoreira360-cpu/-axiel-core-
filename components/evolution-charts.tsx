"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Legend,
} from "recharts";
import type { BiomarkerSeries, AssessmentSeries, VitalPoint, VitalDef } from "@/services/evolution-service";
import { DEFAULT_VITAL_KEYS } from "@/modules/session/session-config";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string, locale: string) {
  return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString(locale, {
    day: "numeric", month: "short",
  });
}

function statusColor(status: string) {
  if (status === "high") return "#EF4444";
  if (status === "low") return "#F59E0B";
  return "#0F6E56";
}

// ── Biomarker chart ───────────────────────────────────────────────────────────

function BiomarkerChart({ series }: { series: BiomarkerSeries }) {
  const t = useTranslations("patientPanels.evolution");
  const locale = useLocale();
  const hasRef = series.points.some((p) => p.ref_min != null || p.ref_max != null);
  const refMin = series.points.find((p) => p.ref_min != null)?.ref_min ?? null;
  const refMax = series.points.find((p) => p.ref_max != null)?.ref_max ?? null;

  const data = series.points.map((p) => ({
    date: fmtDate(p.date, locale),
    value: p.value,
    status: p.status,
    lab: p.lab_name,
  }));

  const values = series.points.map((p) => p.value);
  const allRef = [refMin, refMax, ...values].filter((v) => v != null) as number[];
  const yMin = Math.min(...allRef) * 0.85;
  const yMax = Math.max(...allRef) * 1.15;

  const lastStatus = series.points[series.points.length - 1]?.status ?? "normal";

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-medium text-[#0F1A2E]">{series.name}</p>
          {series.unit && <p className="text-[11px] text-[#A09E98]">{series.unit}</p>}
        </div>
        <span className={[
          "text-[10px] font-medium px-[8px] py-[3px] rounded-full",
          lastStatus === "high" ? "bg-red-50 text-red-500" :
          lastStatus === "low" ? "bg-amber-50 text-amber-600" :
          "bg-[#E1F5EE] text-[#085041]",
        ].join(" ")}>
          {lastStatus === "high" ? t("statusHigh") : lastStatus === "low" ? t("statusLow") : t("statusNormal")}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F4F3EF" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
            domain={[yMin, yMax]}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 8,
              fontSize: 11,
              color: "#0F1A2E",
            }}
            formatter={(val) => [`${val ?? ""} ${series.unit ?? ""}`.trim(), series.name]}
          />
          {hasRef && refMin != null && refMax != null && (
            <ReferenceArea
              y1={refMin} y2={refMax}
              fill="#E1F5EE" fillOpacity={0.4}
              stroke="none"
            />
          )}
          {refMin != null && (
            <ReferenceLine y={refMin} stroke="#0F6E56" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
          )}
          {refMax != null && (
            <ReferenceLine y={refMax} stroke="#0F6E56" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={statusColor(lastStatus)}
            strokeWidth={2}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  key={payload.date}
                  cx={cx} cy={cy} r={4}
                  fill={statusColor(payload.status)}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {hasRef && refMin != null && refMax != null && (
        <p className="text-[10px] text-[#A09E98] mt-2">
          {t("refRange", { min: refMin, max: refMax, unit: series.unit ?? "" })}
        </p>
      )}
    </div>
  );
}

// ── Assessment chart ──────────────────────────────────────────────────────────

function AssessmentChart({ series }: { series: AssessmentSeries }) {
  const t = useTranslations("patientPanels.evolution");
  const locale = useLocale();
  const data = series.points.map((p) => ({
    date: fmtDate(p.date, locale),
    score: Math.round(p.score_percentage),
    total: p.total_score,
    max: p.max_possible_score,
  }));

  const lastScore = data[data.length - 1]?.score ?? 0;
  const scoreColor = lastScore >= 70 ? "#EF4444" : lastScore >= 40 ? "#F59E0B" : "#0F6E56";

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px]">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[13px] font-medium text-[#0F1A2E]">{series.name}</p>
        <span className="text-[10px] font-medium text-[#A09E98]">{t("scorePct")}</span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F4F3EF" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 8,
              fontSize: 11,
              color: "#0F1A2E",
            }}
            formatter={(val, _name, props) => [
              t("tooltipScore", {
                val: String(val ?? ""),
                total: String((props as any).payload?.total ?? ""),
                max: String((props as any).payload?.max ?? ""),
              }),
              series.name,
            ]}
          />
          <ReferenceLine y={40} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
          <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={scoreColor}
            strokeWidth={2}
            dot={{ r: 4, fill: scoreColor, stroke: "#fff", strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1 text-[10px] text-[#A09E98]">
          <span className="inline-block w-3 h-px bg-amber-400" /> {t("legendModerate")}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[#A09E98]">
          <span className="inline-block w-3 h-px bg-red-400" /> {t("legendHigh")}
        </span>
      </div>
    </div>
  );
}

// ── Vitals chart ──────────────────────────────────────────────────────────────

const DEFAULT_VITAL_KEY_SET = new Set<string>(DEFAULT_VITAL_KEYS);

function VitalsChart({ points, vitalDefs, scaleMax }: { points: VitalPoint[]; vitalDefs: VitalDef[]; scaleMax: number }) {
  const t = useTranslations("patientPanels.evolution");
  const locale = useLocale();
  const [visible, setVisible] = useState<Set<string>>(() => new Set(vitalDefs.map((d) => d.key)));

  // Rótulo: label custom da clínica, senão o i18n do vital padrão (dor/energia/
  // humor/sono), senão a própria chave.
  const vitalLines = vitalDefs.map((d) => ({
    key: d.key,
    color: d.color,
    label: d.label || (DEFAULT_VITAL_KEY_SET.has(d.key) ? t(`vitals.${d.key}`) : d.key),
  }));

  const data = points.map((p) => ({ date: fmtDate(p.date, locale), ...p.values }));

  function toggleLine(key: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-medium text-[#0F1A2E]">{t("vitalsTitle")}</p>
          <p className="text-[11px] text-[#A09E98]">{t("vitalsSubtitle")}</p>
        </div>
        <span className="text-[10px] text-[#A09E98]">{t("sessionsCount", { count: points.length })}</span>
      </div>

      {/* Legend / toggle */}
      <div className="flex flex-wrap gap-[8px] mb-[10px]">
        {vitalLines.map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleLine(key)}
            className="flex items-center gap-[5px] text-[11px] transition"
            style={{ opacity: visible.has(key) ? 1 : 0.35 }}
          >
            <span className="inline-block w-3 h-[2px] rounded-full" style={{ backgroundColor: color }} />
            <span style={{ color: visible.has(key) ? "#0F1A2E" : "#A09E98" }}>{label}</span>
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F4F3EF" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#A09E98" }}
            axisLine={false}
            tickLine={false}
            domain={[0, scaleMax + 1]}
            ticks={Array.from({ length: scaleMax }, (_, i) => i + 1)}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 8,
              fontSize: 11,
              color: "#0F1A2E",
            }}
            formatter={(val, name) => [
              val != null ? `${val}/${scaleMax}` : "—",
              vitalLines.find((l) => l.key === (name as string))?.label ?? (name as string),
            ]}
          />
          {vitalLines.map(({ key, color }) =>
            visible.has(key) ? (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3.5, fill: color, stroke: "#fff", strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-[#A09E98] mt-2">
        {t("vitalsHint")}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = "biomarkers" | "assessments" | "vitals";

export function EvolutionCharts({
  biomarkers,
  assessments,
  vitals = [],
  vitalDefs = [],
  vitalsScaleMax = 5,
}: {
  biomarkers: BiomarkerSeries[];
  assessments: AssessmentSeries[];
  vitals?: VitalPoint[];
  vitalDefs?: VitalDef[];
  vitalsScaleMax?: number;
}) {
  const t = useTranslations("patientPanels.evolution");
  const defaultTab: Tab = vitals.length > 0 ? "vitals" : biomarkers.length > 0 ? "biomarkers" : "assessments";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [selectedBiomarker, setSelectedBiomarker] = useState<string | null>(null);

  const visibleBiomarkers = selectedBiomarker
    ? biomarkers.filter((b) => b.name === selectedBiomarker)
    : biomarkers;

  return (
    <div className="space-y-[16px]">
      {/* Tabs */}
      <div className="flex gap-[6px] flex-wrap">
        {vitals.length > 0 && (
          <button
            type="button"
            onClick={() => setTab("vitals")}
            className={[
              "text-[12px] font-medium px-[14px] py-[7px] rounded-[8px] border transition",
              tab === "vitals"
                ? "bg-[#0F1A2E] border-[#0F1A2E] text-white"
                : "bg-white border-black/[.08] text-[#6B6A66] hover:bg-[#F4F3EF]",
            ].join(" ")}
          >
            {t("tabVitals", { count: vitals.length })}
          </button>
        )}
        {biomarkers.length > 0 && (
          <button
            type="button"
            onClick={() => setTab("biomarkers")}
            className={[
              "text-[12px] font-medium px-[14px] py-[7px] rounded-[8px] border transition",
              tab === "biomarkers"
                ? "bg-[#0F1A2E] border-[#0F1A2E] text-white"
                : "bg-white border-black/[.08] text-[#6B6A66] hover:bg-[#F4F3EF]",
            ].join(" ")}
          >
            {t("tabBiomarkers", { count: biomarkers.length })}
          </button>
        )}
        {assessments.length > 0 && (
          <button
            type="button"
            onClick={() => setTab("assessments")}
            className={[
              "text-[12px] font-medium px-[14px] py-[7px] rounded-[8px] border transition",
              tab === "assessments"
                ? "bg-[#0F1A2E] border-[#0F1A2E] text-white"
                : "bg-white border-black/[.08] text-[#6B6A66] hover:bg-[#F4F3EF]",
            ].join(" ")}
          >
            {t("tabAssessments", { count: assessments.length })}
          </button>
        )}
      </div>

      {/* Biomarker filter */}
      {tab === "biomarkers" && biomarkers.length > 1 && (
        <div className="flex flex-wrap gap-[6px]">
          <button
            type="button"
            onClick={() => setSelectedBiomarker(null)}
            className={[
              "text-[11px] px-[10px] py-[4px] rounded-full border transition",
              selectedBiomarker === null
                ? "bg-[#E1F5EE] border-[#0F6E56]/30 text-[#085041]"
                : "bg-white border-black/[.08] text-[#A09E98] hover:bg-[#F4F3EF]",
            ].join(" ")}
          >
            {t("all")}
          </button>
          {biomarkers.map((b) => {
            const last = b.points[b.points.length - 1];
            return (
              <button
                key={b.name}
                type="button"
                onClick={() => setSelectedBiomarker(b.name === selectedBiomarker ? null : b.name)}
                className={[
                  "text-[11px] px-[10px] py-[4px] rounded-full border transition",
                  selectedBiomarker === b.name
                    ? "bg-[#0F1A2E] border-[#0F1A2E] text-white"
                    : last?.status === "high"
                    ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100"
                    : last?.status === "low"
                    ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                    : "bg-white border-black/[.08] text-[#6B6A66] hover:bg-[#F4F3EF]",
                ].join(" ")}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Vitals chart */}
      {tab === "vitals" && <VitalsChart points={vitals} vitalDefs={vitalDefs} scaleMax={vitalsScaleMax} />}

      {/* Charts grid */}
      {tab === "biomarkers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          {visibleBiomarkers.map((b) => (
            <BiomarkerChart key={b.name} series={b} />
          ))}
        </div>
      )}

      {tab === "assessments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          {assessments.map((a) => (
            <AssessmentChart key={a.template_id} series={a} />
          ))}
        </div>
      )}
    </div>
  );
}
