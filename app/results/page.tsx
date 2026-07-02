import dynamic from "next/dynamic";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { getBusinessAnalytics } from "@/services/business-analytics-service";
import { ResultsInsights } from "@/components/results-insights";
import { getClinicCurrency } from "@/services/finance-service";

const ResultsChart = dynamic(
  () => import("@/components/results-chart").then((m) => m.ResultsChart),
  { loading: () => <div className="h-[252px] animate-pulse rounded-[12px] bg-black/[.03] dark:bg-white/[.04]" /> }
);

const ResultsExportButton = dynamic(
  () => import("@/components/results-export-button").then((m) => m.ResultsExportButton),
  { loading: () => null }
);

const ResultsSendReportButton = dynamic(
  () => import("@/components/results-send-report-button").then((m) => m.ResultsSendReportButton),
  { loading: () => null }
);

const PERIOD_OPTIONS = [1, 3, 6, 12];

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const sp = await searchParams;
  const monthsParam = parseInt(sp.months ?? "3", 10);
  const months = [1, 3, 6, 12].includes(monthsParam) ? monthsParam : 3;

  const t = await getTranslations("results.page");
  const locale = await getLocale();
  const fmt = (cents: number) => (cents / 100).toLocaleString(locale, { style: "currency", currency: __cur });

  const clinic = await getCurrentClinic();
  const __cur = await getClinicCurrency(clinic?.id ?? "");
  const data = clinic ? await getBusinessAnalytics(clinic.id, months) : null;

  if (!data) {
    return (
      <Shell>
        <p className="text-[13px] text-[#A09E98]">{t("notFound")}</p>
      </Shell>
    );
  }

  const topService = data.services[0];

  return (
    <Shell>
      {/* Header */}
      <div className="mb-[18px] flex items-start justify-between gap-[12px]">
        <div>
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98]">{t("eyebrow")}</p>
          <h1 className="mt-[4px] text-[20px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">
            {t("title")}
          </h1>
          <p className="mt-[2px] text-[12px] text-[#A09E98]">
            {data.period.from} → {data.period.to}
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          <ResultsSendReportButton />
          <ResultsExportButton data={data} />
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-[6px] mb-[18px]">
        {PERIOD_OPTIONS.map((opt) => (
          <Link
            key={opt}
            href={`/results?months=${opt}`}
            className={[
              "px-[12px] py-[6px] rounded-[8px] text-[11px] font-medium transition",
              months === opt
                ? "bg-[#0F1A2E] text-white"
                : "bg-white dark:bg-[#111827] border border-black/[.09] dark:border-white/[.09] text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06]",
            ].join(" ")}
          >
            {t("periodMonths", { count: opt })}
          </Link>
        ))}
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] mb-[14px]">
        {[
          { label: t("kpiRevenue"),     value: fmt(data.revenue_cents),              sub: t("packagesSold", { count: data.packages_sold }) },
          { label: t("kpiSessions"),    value: String(data.sessions_total),           sub: t("perPatient", { count: data.avg_sessions_per_patient }) },
          { label: t("kpiReturn"),      value: `${data.return_rate}%`,               sub: t("activePatients", { count: data.active_patients }), green: data.return_rate >= 60 },
          { label: t("kpiConversion"),  value: `${data.conversion_rate}%`,           sub: t("newThisPeriod", { count: data.new_patients }) },
        ].map((m) => (
          <div key={m.label} className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[10px] p-[13px]">
            <p className="text-[10px] text-[#A09E98] tracking-[.04em] mb-[5px]">{m.label}</p>
            <p className={`text-[20px] font-medium tracking-[-0.03em] leading-none ${m.green ? "text-[#0F6E56] dark:text-[#9FE1CB]" : "text-[#0F1A2E] dark:text-[#E8E6E2]"}`}>
              {m.value}
            </p>
            <p className="text-[10px] mt-[3px] text-[#A09E98]">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart — evolução mensal (só mostra se tiver ≥ 2 meses) */}
      {months >= 2 && (
        <div className="mb-[14px]">
          <ResultsChart monthly={data.monthly} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-[12px]">

        {/* Coluna esquerda */}
        <div className="space-y-[12px]">

          {/* Serviços */}
          <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] p-[15px]">
            <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-[12px]">{t("servicesTitle")}</p>
            {data.services.length === 0 ? (
              <p className="text-[12px] text-[#A09E98]">
                {t("noServices")}{" "}
                <span className="text-[#0F6E56] dark:text-[#9FE1CB]">{t("noServicesHint")}</span>
              </p>
            ) : (
              <div className="space-y-[8px]">
                {data.services.map((s) => {
                  const pct = data.sessions_total > 0
                    ? Math.round((s.sessions / data.sessions_total) * 100)
                    : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-[3px]">
                        <span className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] font-medium">{s.name}</span>
                        <div className="flex items-center gap-[10px]">
                          <span className="text-[11px] text-[#A09E98]">{t("sessionsCount", { count: s.sessions })}</span>
                          {s.revenue_cents > 0 && (
                            <span className="text-[11px] font-medium text-[#0F6E56] dark:text-[#9FE1CB]">{fmt(s.revenue_cents)}</span>
                          )}
                        </div>
                      </div>
                      <div className="h-[5px] rounded-full bg-[#F4F3EF] dark:bg-white/[.06]">
                        <div
                          className="h-full rounded-full bg-[#0F6E56]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Origem dos agendamentos */}
          <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] p-[15px]">
            <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-[12px]">{t("sourcesTitle")}</p>
            {data.sources.length === 0 ? (
              <p className="text-[12px] text-[#A09E98]">
                {t("noSources")}
              </p>
            ) : (
              <div className="space-y-[8px]">
                {data.sources.map((s) => {
                  const pct = data.sessions_total > 0
                    ? Math.round((s.count / data.sessions_total) * 100)
                    : 0;
                  return (
                    <div key={s.source}>
                      <div className="flex items-center justify-between mb-[3px]">
                        <span className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2]">{s.source}</span>
                        <span className="text-[11px] text-[#A09E98]">{s.count} ({pct}%)</span>
                      </div>
                      <div className="h-[5px] rounded-full bg-[#F4F3EF] dark:bg-white/[.06]">
                        <div
                          className="h-full rounded-full bg-[#3D2E8F]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo financeiro */}
          <div className="bg-[#0F1A2E] rounded-[12px] p-[15px]">
            <p className="text-[10px] font-medium text-white/40 tracking-[.08em] uppercase mb-[10px]">
              {t("financialSummary")}
            </p>
            <div className="space-y-[8px]">
              {[
                { label: t("sumRevenue"),    value: fmt(data.packages_revenue_cents) },
                { label: t("sumPackages"),   value: String(data.packages_sold) },
                { label: t("sumTicket"),     value: data.packages_sold > 0 ? fmt(Math.round(data.packages_revenue_cents / data.packages_sold)) : "—" },
                { label: t("sumSessions"),   value: String(data.sessions_total) },
                topService ? { label: t("sumLeader"), value: topService.name } : null,
              ].filter(Boolean).map((item) => (
                <div key={item!.label} className="flex items-center justify-between">
                  <p className="text-[12px] text-white/60">{item!.label}</p>
                  <p className="text-[13px] font-semibold text-white">{item!.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita — AI Insights (carrega de forma assíncrona após o render) */}
        <div className="space-y-[12px]">
          <ResultsInsights months={months} />

          {/* Métricas de retenção */}
          <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] p-[15px]">
            <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-[10px]">Retenção e engajamento</p>
            <div className="space-y-[10px]">
              {[
                { label: "Taxa de retorno",         value: `${data.return_rate}%`,              note: "pacientes que voltaram" },
                { label: "Sessões por paciente",    value: `${data.avg_sessions_per_patient}×`,  note: "média no período" },
                { label: "Novos pacientes",         value: String(data.new_patients),            note: "no período" },
                { label: "Conv. leads → pacientes", value: `${data.conversion_rate}%`,           note: "taxa de fechamento" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2]">{m.label}</p>
                    <p className="text-[10px] text-[#A09E98]">{m.note}</p>
                  </div>
                  <p className="text-[15px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
