"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, UserX, CalendarX, TrendingDown, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import type { StatusReport } from "@/services/appointment-report-service";
import { formatMoney } from "@/lib/finance-utils";

// Converte "YYYY-MM" no intervalo [primeiro dia 00:00, último dia 23:59:59] em
// ISO local (mesmo padrão de currentMonthRange em finance-utils).
function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1, 0, 0, 0).toISOString();
  const to = new Date(y, m, 0, 23, 59, 59).toISOString();
  return { from, to };
}

function thisMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function MetricCard({ label, value, sub, icon: Icon, tone }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: "danger" | "neutral" | "positive";
}) {
  const valueColor =
    tone === "danger"
      ? "text-[#B4231F] dark:text-[#F0A6A3]"
      : tone === "positive"
        ? "text-[#0F6E56] dark:text-[#5FD3B2]"
        : "text-[#0F1A2E] dark:text-[#E8E6E2]";
  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 dark:text-white/35">{label}</p>
        <Icon className="h-4 w-4 text-black/20 dark:text-white/20" />
      </div>
      <p className={`text-[24px] font-semibold tracking-[-0.03em] ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-black/40 dark:text-white/40 mt-1">{sub}</p>}
    </div>
  );
}

export function AgendamentosReportClient() {
  const t = useTranslations("finance.statusReport");
  const locale = useLocale();

  const [month, setMonth] = useState<string>(thisMonthKey());
  const [data, setData] = useState<StatusReport | null>(null);
  const [loading, setLoading] = useState(true);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  }, [month, locale]);

  const isCurrentMonth = month >= thisMonthKey();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = monthRange(month);
      const res = await fetch(`/api/reports/agendamentos-status?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as StatusReport;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const money = useCallback(
    (cents: number) => formatMoney(cents, data?.currency ?? "BRL", locale),
    [data?.currency, locale],
  );

  return (
    <div className="space-y-6">
      {/* Seletor de mês */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonth((mo) => shiftMonth(mo, -1))}
          aria-label={t("prevMonth")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[.10] dark:border-white/[.10] text-black/50 dark:text-white/50 hover:bg-black/[.04] dark:hover:bg-white/[.06] transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-[150px] text-center">
          <p className="text-[13px] font-medium capitalize text-[#0F1A2E] dark:text-[#E8E6E2]">{monthLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setMonth((mo) => shiftMonth(mo, 1))}
          disabled={isCurrentMonth}
          aria-label={t("nextMonth")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[.10] dark:border-white/[.10] text-black/50 dark:text-white/50 hover:bg-black/[.04] dark:hover:bg-white/[.06] transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <input
          type="month"
          value={month}
          max={thisMonthKey()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="ml-1 rounded-lg border border-black/[.10] dark:border-white/[.10] bg-white dark:bg-[#111827] px-2.5 py-1.5 text-[12px] text-black/60 dark:text-white/60"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-black/30 dark:text-white/30" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-sm text-black/40 dark:text-white/40">{t("loadError")}</div>
      ) : data.totals.considered === 0 ? (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-12 text-center">
          <p className="text-sm font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{t("emptyTitle")}</p>
          <p className="text-xs text-black/40 dark:text-white/40 mt-1">{t("emptyDesc")}</p>
        </div>
      ) : (
        <>
          {/* Cards de métrica */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              label={t("kpiNoShow")}
              value={pct(data.rates.no_show_rate)}
              sub={t("kpiNoShowSub", { count: data.totals.no_show, considered: data.totals.considered })}
              icon={UserX}
              tone={data.totals.no_show > 0 ? "danger" : "positive"}
            />
            <MetricCard
              label={t("kpiCancellation")}
              value={pct(data.rates.cancellation_rate)}
              sub={t("kpiCancellationSub", {
                notice: data.totals.cancelled_notice,
                late: data.totals.late_cancel,
              })}
              icon={CalendarX}
              tone="neutral"
            />
            <MetricCard
              label={t("kpiLostRevenue")}
              value={money(data.lost_revenue_cents)}
              sub={
                data.lost_revenue_unpriced > 0
                  ? t("kpiLostRevenueUnpriced", { count: data.lost_revenue_unpriced })
                  : t("kpiLostRevenueSub")
              }
              icon={TrendingDown}
              tone={data.lost_revenue_cents > 0 ? "danger" : "positive"}
            />
            <MetricCard
              label={t("kpiOccupancy")}
              value={String(data.totals.completed + data.totals.checked_in)}
              sub={t("kpiOccupancySub", { total: data.totals.considered })}
              icon={CheckCircle2}
              tone="positive"
            />
          </div>

          {/* Detalhe do cancelamento: com aviso vs tardio */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 dark:text-white/35">{t("cancelBreakdownTitle")}</p>
            {(() => {
              const notice = data.totals.cancelled_notice;
              const late = data.totals.late_cancel;
              const totalCancel = notice + late;
              const rows = [
                { key: "notice", label: t("withNotice"), value: notice, color: "bg-[#0F6E56]" },
                { key: "late", label: t("lateCancel"), value: late, color: "bg-[#B4231F]" },
              ];
              return (
                <div className="space-y-2.5">
                  {rows.map((r) => {
                    const barPct = totalCancel > 0 ? Math.round((r.value / totalCancel) * 100) : 0;
                    return (
                      <div key={r.key}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{r.label}</span>
                          <span className="text-[12px] text-black/60 dark:text-white/60">
                            {r.value}
                            <span className="text-black/35 dark:text-white/35 ml-1">({barPct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/[.06] dark:bg-white/[.08] overflow-hidden">
                          <div className={`h-full rounded-full ${r.color} transition-all duration-500`} style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Ocupação e desempenho por profissional */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-black/[.07] dark:border-white/[.07] overflow-hidden">
            <div className="px-5 py-4 border-b border-black/[.06] dark:border-white/[.06]">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 dark:text-white/35">{t("byPractitionerTitle")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-black/[.05] dark:border-white/[.05]">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 dark:text-white/35">{t("colPractitioner")}</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 dark:text-white/35">{t("colSessions")}</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 dark:text-white/35">{t("colNoShow")}</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 dark:text-white/35 hidden sm:table-cell">{t("colLateCancel")}</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 dark:text-white/35 hidden md:table-cell">{t("colNotice")}</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 dark:text-white/35">{t("colLostRevenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_practitioner.map((row) => (
                    <tr key={row.practitioner_id ?? "none"} className="border-b border-black/[.04] dark:border-white/[.04] hover:bg-black/[.02] dark:hover:bg-white/[.04] transition">
                      <td className="px-5 py-3 font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{row.name}</td>
                      <td className="px-5 py-3 text-right text-black/55 dark:text-white/55">{row.sessions_done}</td>
                      <td className="px-5 py-3 text-right text-black/55 dark:text-white/55">{row.no_show}</td>
                      <td className="px-5 py-3 text-right text-black/55 dark:text-white/55 hidden sm:table-cell">{row.late_cancel}</td>
                      <td className="px-5 py-3 text-right text-black/55 dark:text-white/55 hidden md:table-cell">{row.cancelled_notice}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
                        {row.lost_revenue_cents > 0 ? money(row.lost_revenue_cents) : <span className="text-black/25 dark:text-white/25">·</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-black/35 dark:text-white/35">{t("footnote")}</p>
        </>
      )}
    </div>
  );
}
