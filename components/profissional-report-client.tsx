"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, TrendingUp, Calendar, Star, CheckCircle2 } from "lucide-react";
import type { ProfessionalReport } from "@/app/api/professionals/[id]/report/route";

function formatBRL(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const PERIODS = [
  { value: "this_month",  labelKey: "periodThisMonth" },
  { value: "last_month",  labelKey: "periodLastMonth" },
  { value: "last_3m",     labelKey: "period3m" },
  { value: "last_6m",     labelKey: "period6m" },
  { value: "this_year",   labelKey: "periodThisYear" },
];

interface Props { professionalId: string }

export function ProfissionalReportClient({ professionalId }: Props) {
  const t = useTranslations("professionals.report");
  const tRoles = useTranslations("common.roles");
  const locale = useLocale();
  const [period, setPeriod] = useState("this_month");
  const [report, setReport] = useState<ProfessionalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/professionals/${professionalId}/report?period=${period}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) return;
      setReport(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [professionalId, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (notFound) {
    return <p className="text-sm text-black/40 py-10 text-center">{t("notFound")}</p>;
  }

  const maxSessions  = Math.max(...(report?.monthlyTrend.map((m) => m.sessions) ?? [1]), 1);
  const maxRevenue   = Math.max(...(report?.monthlyTrend.map((m) => m.revenueCents) ?? [1]), 1);
  const maxTypeCount = Math.max(...(report?.bySessionType.map((st) => st.count) ?? [1]), 1);

  return (
    <div className="space-y-6">
      {/* Professional header */}
      {report && (
        <div className="flex items-center gap-4 bg-white rounded-2xl border border-black/[.07] p-5">
          <div className="w-12 h-12 rounded-full bg-[#0F1A2E]/10 flex items-center justify-center shrink-0">
            <span className="text-[15px] font-bold text-[#0F1A2E]">
              {initials(report.professional.fullName)}
            </span>
          </div>
          <div>
            <p className="text-[16px] font-semibold text-[#0F1A2E]">
              {report.professional.displayName ?? report.professional.fullName}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {report.professional.specialty && (
                <span className="text-[12px] text-black/50">{report.professional.specialty}</span>
              )}
              <span className="text-[10px] bg-black/[.06] text-black/40 rounded-full px-2 py-0.5">
                {tRoles(report.professional.role)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={[
              "px-3 py-1.5 rounded-lg text-[12px] font-medium transition",
              period === p.value
                ? "bg-[#0F1A2E] text-white"
                : "bg-white border border-black/[.10] text-black/60 hover:bg-black/[.04]",
            ].join(" ")}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-black/30" />
        </div>
      ) : !report ? (
        <div className="text-center py-10 text-sm text-black/40">{t("loadError")}</div>
      ) : (
        <>
          <p className="text-[13px] font-medium text-black/50 capitalize">{report.period.label}</p>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: "completed", label: t("kpiCompleted"), value: String(report.completed), sub: t("kpiCompletedSub", { count: report.totalSessions }), icon: Calendar },
              { key: "rate", label: t("kpiCompletionRate"),  value: `${report.completionRate}%`, sub: t("kpiCompletionSub", { count: report.noShow }), icon: CheckCircle2 },
              { key: "revenue", label: t("kpiRevenue"),      value: formatBRL(report.totalRevenueCents, locale), sub: t("kpiRevenueSub", { value: formatBRL(report.avgTicketCents, locale) }), icon: TrendingUp },
              { key: "nps", label: t("kpiNps"),              value: report.avgNps !== null ? report.avgNps.toFixed(1) : "—", sub: report.npsIndex !== null ? t("kpiNpsIndex", { value: `${report.npsIndex > 0 ? "+" : ""}${report.npsIndex}` }) : t("kpiNpsRatings", { count: report.npsTotal }), icon: Star },
            ].map(({ key, label, value, sub, icon: Icon }) => (
              <div key={key} className="bg-white rounded-2xl border border-black/[.07] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/35">{label}</p>
                  <Icon className="h-3.5 w-3.5 text-black/20" />
                </div>
                <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F1A2E]">{value}</p>
                {sub && <p className="text-[11px] text-black/40 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Session status breakdown */}
          <div className="bg-white rounded-2xl border border-black/[.07] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 mb-4">{t("statusTitle")}</p>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { key: "completed", label: t("statusCompleted"), value: report.completed, color: "#0F6E56" },
                { key: "scheduled", label: t("statusScheduled"), value: report.scheduled, color: "#3B82F6" },
                { key: "cancelled", label: t("statusCancelled"), value: report.cancelled, color: "#F59E0B" },
                { key: "no_show",   label: t("statusNoShow"),    value: report.noShow,    color: "#EF4444" },
              ].map(({ key, label, value, color }) => (
                <div key={key}>
                  <p className="text-[24px] font-semibold" style={{ color }}>{value}</p>
                  <p className="text-[11px] text-black/40 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly trend */}
            <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35">{t("monthlyTrend")}</p>
              <div className="space-y-3">
                {report.monthlyTrend.map((m) => (
                  <div key={m.month}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[11px] text-black/50 capitalize">{m.month}</span>
                      <div className="flex items-baseline gap-3">
                        <span className="text-[11px] font-medium text-[#0F1A2E]">{t("sessionsCount", { count: m.sessions })}</span>
                        <span className="text-[11px] text-black/40">{formatBRL(m.revenueCents, locale)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div className="h-1.5 rounded-full bg-black/[.06] flex-1">
                        <div className="h-full rounded-full bg-[#0F6E56]" style={{ width: `${Math.round((m.sessions / maxSessions) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Session types */}
            <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35">{t("bySessionType")}</p>
              {report.bySessionType.length === 0 ? (
                <p className="text-sm text-black/30">{t("noData")}</p>
              ) : (
                <div className="space-y-2.5">
                  {report.bySessionType.map((st) => (
                    <div key={st.name}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[12px] font-medium text-[#0F1A2E] truncate max-w-[55%]">{st.name}</span>
                        <span className="text-[12px] text-black/55 shrink-0">
                          {st.count}× · {formatBRL(st.revenueCents, locale)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/[.06]">
                        <div className="h-full rounded-full bg-[#0F6E56]/60" style={{ width: `${Math.round((st.count / maxTypeCount) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* NPS breakdown */}
          {report.npsTotal > 0 && (
            <div className="bg-white rounded-2xl border border-black/[.07] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 mb-4">
                {t("npsTitle", { count: report.npsTotal })}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                {[
                  { key: "promoters", label: t("npsPromoters"), pct: report.promotersPct, color: "#0F6E56" },
                  { key: "passives",  label: t("npsPassives"),  pct: 100 - report.promotersPct - report.detractorsPct, color: "#F59E0B" },
                  { key: "detractors", label: t("npsDetractors"), pct: report.detractorsPct, color: "#EF4444" },
                ].map(({ key, label, pct, color }) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[12px] text-black/55">{label}</span>
                    <span className="text-[13px] font-semibold" style={{ color }}>{pct}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-2 rounded-full overflow-hidden flex">
                <div className="h-full bg-[#0F6E56]" style={{ width: `${report.promotersPct}%` }} />
                <div className="h-full bg-[#F59E0B]" style={{ width: `${100 - report.promotersPct - report.detractorsPct}%` }} />
                <div className="h-full bg-[#EF4444]" style={{ width: `${report.detractorsPct}%` }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
