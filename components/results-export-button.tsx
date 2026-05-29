"use client";

import type { BusinessAnalytics } from "@/services/business-analytics-service";

function fmtBRL(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

interface Props {
  data: Pick<BusinessAnalytics,
    | "period" | "months" | "revenue_cents" | "sessions_total"
    | "active_patients" | "new_patients" | "return_rate"
    | "avg_sessions_per_patient" | "conversion_rate"
    | "packages_sold" | "packages_revenue_cents" | "monthly"
  >;
}

export function ResultsExportButton({ data }: Props) {
  function handleExport() {
    const rows: string[] = [];

    // Summary block
    rows.push("RESUMO DO PERÍODO");
    rows.push(`Período;${data.period.from} → ${data.period.to}`);
    rows.push(`Meses analisados;${data.months}`);
    rows.push(`Receita total (R$);${fmtBRL(data.revenue_cents)}`);
    rows.push(`Total de sessões;${data.sessions_total}`);
    rows.push(`Pacientes ativos;${data.active_patients}`);
    rows.push(`Novos pacientes;${data.new_patients}`);
    rows.push(`Taxa de retorno (%);${data.return_rate}`);
    rows.push(`Sessões por paciente;${data.avg_sessions_per_patient}`);
    rows.push(`Conversão leads→pacientes (%);${data.conversion_rate}`);
    rows.push(`Pacotes vendidos;${data.packages_sold}`);
    rows.push(`Receita pacotes (R$);${fmtBRL(data.packages_revenue_cents)}`);
    rows.push("");

    // Monthly block
    rows.push("EVOLUÇÃO MENSAL");
    rows.push("Mês;Sessões;Novos pacientes;Receita (R$)");
    for (const m of data.monthly) {
      rows.push(`${m.month};${m.sessions};${m.new_patients};${fmtBRL(m.revenue_cents)}`);
    }

    const csv = "﻿" + rows.join("\n"); // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axiel-resultados-${data.period.to.replace(/\s/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-[6px] rounded-[8px] border border-black/[.1] bg-white px-[12px] py-[7px] text-[11px] font-medium text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1v7M3 5.5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Exportar CSV
    </button>
  );
}
