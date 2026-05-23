"use client";

import { useState } from "react";
import { Download, FileText, Table2, Users } from "lucide-react";

type ReportCard = {
  id: string;
  title: string;
  description: string;
  icon: "pdf" | "csv" | "leads";
  buildUrl: (from: string, to: string, month: string) => string;
  needsDateRange?: boolean;
  needsMonth?: boolean;
};

const REPORTS: ReportCard[] = [
  {
    id: "financeiro",
    title: "Relatório financeiro",
    description: "Receita total, ticket médio, pagamentos por método e lista detalhada de cobranças.",
    icon: "pdf",
    buildUrl: (from, to) => `/api/reports/financeiro${from ? `?from=${from}&to=${to}` : ""}`,
    needsDateRange: true,
  },
  {
    id: "repasse",
    title: "Repasse médico",
    description: "Resumo de repasse por profissional, sessões atendidas, receita bruta e valor calculado.",
    icon: "pdf",
    buildUrl: (_from, _to, month) => `/api/reports/repasse${month ? `?month=${month}` : ""}`,
    needsMonth: true,
  },
  {
    id: "pagamentos",
    title: "Extrato de pagamentos",
    description: "Planilha com todos os pagamentos: paciente, data, método, tipo de sessão e valor.",
    icon: "csv",
    buildUrl: (from, to) => `/api/reports/pagamentos${from ? `?from=${from}&to=${to}` : ""}`,
    needsDateRange: true,
  },
  {
    id: "sessoes",
    title: "Histórico de sessões",
    description: "Todas as consultas com paciente, tipo, status, duração e valor.",
    icon: "csv",
    buildUrl: (from, to) => `/api/reports/sessoes${from ? `?from=${from}&to=${to}` : ""}`,
    needsDateRange: true,
  },
  {
    id: "pacientes",
    title: "Lista de pacientes",
    description: "Todos os pacientes da clínica: nome, e-mail, telefone, status e data de cadastro.",
    icon: "csv",
    buildUrl: () => "/api/reports/pacientes",
  },
  {
    id: "leads",
    title: "Pipeline de leads",
    description: "Todos os leads com etapa, origem, queixa principal e data de cadastro.",
    icon: "leads",
    buildUrl: () => "/api/reports/leads",
  },
];

function defaultFrom() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function defaultTo() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}
function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function RelatoriosClient() {
  const [from,  setFrom]  = useState(defaultFrom());
  const [to,    setTo]    = useState(defaultTo());
  const [month, setMonth] = useState(defaultMonth());

  return (
    <div className="space-y-4">
      {/* ── Filtro de período ── */}
      <div className="bg-white border border-black/[.07] rounded-[12px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-3">
          Filtro de período para exportação
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#6B6A66]">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-[8px] border border-black/15 px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F6E56]/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#6B6A66]">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-[8px] border border-black/15 px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F6E56]/40"
            />
          </div>
          <div className="h-4 w-px bg-black/10 hidden sm:block" />
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#6B6A66]">Mês repasse</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-[8px] border border-black/15 px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F6E56]/40"
            />
          </div>
        </div>
      </div>

      {/* ── Cards de relatório ── */}
      <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98]">Exportações disponíveis</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const url     = r.buildUrl(from, to, month);
          const isLeads = r.icon === "leads";
          const isPdf   = r.icon === "pdf";

          const iconBg    = isPdf ? "bg-[#FEF3C7]" : isLeads ? "bg-[#E8F0FE]" : "bg-[#E1F5EE]";
          const iconColor = isPdf ? "text-amber-600" : isLeads ? "text-blue-600" : "text-[#0F6E56]";

          const sep = url.includes("?") ? "&" : "?";

          return (
            <div
              key={r.id}
              className="bg-white border border-black/[.07] rounded-[12px] p-4 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ${iconBg}`}>
                  {isPdf    ? <FileText className={`h-4 w-4 ${iconColor}`} /> :
                   isLeads  ? <Users    className={`h-4 w-4 ${iconColor}`} /> :
                              <Table2   className={`h-4 w-4 ${iconColor}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F1A2E]">{r.title}</p>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-50 text-amber-600">PDF</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#E1F5EE] text-[#0F6E56]">CSV</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#E8F5E9] text-[#2E7D32]">XLS</span>
                  </div>
                  <p className="text-[11px] text-[#A09E98] mt-1 leading-relaxed">{r.description}</p>
                  {r.needsDateRange && (
                    <p className="text-[10px] text-[#D3D1C7] mt-1">Período: {from} → {to}</p>
                  )}
                  {r.needsMonth && (
                    <p className="text-[10px] text-[#D3D1C7] mt-1">Mês: {month}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={`${url}${sep}format=pdf`}
                  download
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2 text-[11px] font-medium transition bg-[#0B1F3A] text-white hover:bg-black"
                >
                  <Download className="h-3 w-3" />
                  PDF
                </a>
                <a
                  href={`${url}${sep}format=csv`}
                  download
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2 text-[11px] font-medium transition bg-[#E1F5EE] text-[#0F6E56] hover:bg-[#d0f0e6]"
                >
                  <Download className="h-3 w-3" />
                  CSV
                </a>
                <a
                  href={`${url}${sep}format=xlsx`}
                  download
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-2 text-[11px] font-medium transition bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9]"
                >
                  <Download className="h-3 w-3" />
                  Excel
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
