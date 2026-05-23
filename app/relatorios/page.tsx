import { getCurrentClinic } from "@/services/clinic-service";
import { getFinanceKPIs, formatBRL } from "@/services/finance-service";
import { getLeadStageCounts, getPatientCounts } from "@/services/stats-service";
import { getDashboardKPIs } from "@/modules/dashboard/dashboard-kpis";
import { getReportTimeSeries } from "@/services/report-service";
import { Shell } from "@/components/shell";
import { RelatoriosClient } from "./relatorios-client";
import { RelatoriosCharts } from "@/components/relatorios-charts";

function deltaLabel(current: number, prev: number): { text: string; up: boolean | null } {
  if (prev === 0 && current === 0) return { text: "sem dados", up: null };
  if (prev === 0) return { text: "primeiro mês com dados", up: null };
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return { text: "igual ao mês passado", up: null };
  return { text: `${pct > 0 ? "+" : ""}${pct}% vs. mês passado`, up: pct > 0 };
}

export default async function RelatoriosPage() {
  const clinic = await getCurrentClinic();

  const [financeKPIs, dashKPIs, leadCounts, patientCounts, timeSeries] = await Promise.all([
    clinic ? getFinanceKPIs(clinic.id) : null,
    clinic ? getDashboardKPIs(clinic.id) : null,
    clinic ? getLeadStageCounts(clinic.id) : Promise.resolve(null),
    clinic ? getPatientCounts(clinic.id) : Promise.resolve(null),
    clinic ? getReportTimeSeries(clinic.id, 12) : null,
  ]);

  // ── Leads funnel ──
  const leadsByStage = {
    new_lead:             leadCounts?.new_lead ?? 0,
    contacted:            leadCounts?.contacted ?? 0,
    scheduled:            leadCounts?.scheduled ?? 0,
    converted_to_patient: leadCounts?.converted_to_patient ?? 0,
  };
  const totalLeads = leadCounts?.total ?? 0;
  const conversionRate = totalLeads > 0
    ? Math.round((leadsByStage.converted_to_patient / totalLeads) * 100)
    : 0;

  // ── Patients ──
  const activePatients = patientCounts?.active ?? 0;
  const newThisMonth = patientCounts?.newThisMonth ?? 0;

  const revDelta = financeKPIs
    ? deltaLabel(financeKPIs.revenueThisMonth, financeKPIs.revenueLastMonth)
    : null;

  const sessionsDelta = dashKPIs
    ? deltaLabel(dashKPIs.sessionsThisMonth, dashKPIs.sessionsLastMonth)
    : null;

  const kpis = [
    {
      label: "RECEITA DO MÊS",
      value: financeKPIs ? formatBRL(financeKPIs.revenueThisMonth) : "—",
      sub: revDelta?.text ?? "—",
      up: revDelta?.up,
    },
    {
      label: "SESSÕES DO MÊS",
      value: dashKPIs ? String(dashKPIs.sessionsThisMonth) : "—",
      sub: sessionsDelta?.text ?? "—",
      up: sessionsDelta?.up,
    },
    {
      label: "PACIENTES ATIVOS",
      value: String(activePatients),
      sub: `${newThisMonth} novo${newThisMonth !== 1 ? "s" : ""} este mês`,
      up: null,
    },
    {
      label: "CONVERSÃO DE LEADS",
      value: `${conversionRate}%`,
      sub: `${leadsByStage.converted_to_patient} de ${totalLeads} leads`,
      up: null,
    },
  ];

  return (
    <Shell>
      {/* ── Header ── */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Clínica</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Relatórios</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Dados em tempo real e exportações para PDF ou planilha.
        </p>
      </div>

      {/* ── Resumo do mês atual ── */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-3">Resumo do mês atual</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px]">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white border border-black/[.07] rounded-[10px] p-[13px]">
              <p className="text-[10px] text-[#A09E98] tracking-[.04em] mb-[5px]">{k.label}</p>
              <p className="text-[22px] font-semibold tracking-[-0.03em] text-[#0F1A2E] leading-none">{k.value}</p>
              <p className={`text-[10px] mt-[4px] ${
                k.up === true  ? "text-[#0F6E56]" :
                k.up === false ? "text-red-400"   :
                "text-[#A09E98]"
              }`}>
                {k.up === true ? "↑ " : k.up === false ? "↓ " : ""}{k.sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Funil de leads ── */}
      {totalLeads > 0 && (
        <div className="mb-6 bg-white border border-black/[.07] rounded-[12px] p-[15px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-4">Funil de leads</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Novo lead",    count: leadsByStage.new_lead,             color: "#E8F0FE", text: "#3B6BE4" },
              { label: "Contatado",    count: leadsByStage.contacted,            color: "#FEF9E7", text: "#B7791F" },
              { label: "Agendado",     count: leadsByStage.scheduled,            color: "#E1F5EE", text: "#0F6E56" },
              { label: "Convertido",   count: leadsByStage.converted_to_patient, color: "#0F1A2E", text: "#FFFFFF" },
            ].map((stage) => (
              <div
                key={stage.label}
                className="rounded-[8px] p-3 text-center"
                style={{ backgroundColor: stage.color }}
              >
                <p className="text-[22px] font-semibold leading-none" style={{ color: stage.text }}>
                  {stage.count}
                </p>
                <p className="text-[10px] mt-1 font-medium" style={{ color: stage.text, opacity: 0.75 }}>
                  {stage.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Evolução histórica ── */}
      {timeSeries && (
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-3">Evolução histórica</p>
          <RelatoriosCharts data={timeSeries} />
        </div>
      )}

      {/* ── Downloads ── */}
      <RelatoriosClient />
    </Shell>
  );
}
