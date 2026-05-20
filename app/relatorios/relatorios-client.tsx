"use client";

import { useState } from "react";
import { Download, FileText, Table } from "lucide-react";

type ReportCard = {
  id: string;
  title: string;
  description: string;
  format: "PDF" | "CSV";
  icon: "pdf" | "csv";
  buildUrl: (from: string, to: string, month: string) => string;
  needsDateRange?: boolean;
  needsMonth?: boolean;
};

const REPORTS: ReportCard[] = [
  {
    id: "financeiro",
    title: "Relatório financeiro",
    description: "Receita total, ticket médio, pagamentos por método e lista detalhada de cobranças.",
    format: "PDF",
    icon: "pdf",
    buildUrl: (from, to) => `/api/reports/financeiro${from ? `?from=${from}&to=${to}` : ""}`,
    needsDateRange: true,
  },
  {
    id: "repasse",
    title: "Repasse médico",
    description: "Resumo de repasse por profissional, sessões atendidas, receita bruta e valor calculado.",
    format: "PDF",
    icon: "pdf",
    buildUrl: (_from, _to, month) => `/api/reports/repasse${month ? `?month=${month}` : ""}`,
    needsMonth: true,
  },
  {
    id: "pagamentos",
    title: "Extrato de pagamentos",
    description: "Planilha com todos os pagamentos: paciente, data, método, tipo de sessão e valor.",
    format: "CSV",
    icon: "csv",
    buildUrl: (from, to) => `/api/reports/pagamentos${from ? `?from=${from}&to=${to}` : ""}`,
    needsDateRange: true,
  },
  {
    id: "pacientes",
    title: "Lista de pacientes",
    description: "Todos os pacientes da clínica: nome, e-mail, telefone, status e data de cadastro.",
    format: "CSV",
    icon: "csv",
    buildUrl: () => "/api/reports/pacientes",
  },
  {
    id: "sessoes",
    title: "Histórico de sessões",
    description: "Todas as consultas com paciente, tipo, status, duração e valor.",
    format: "CSV",
    icon: "csv",
    buildUrl: (from, to) => `/api/reports/sessoes${from ? `?from=${from}&to=${to}` : ""}`,
    needsDateRange: true,
  },
];

// Default: current month
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
    <div className="space-y-5">
      {/* Date range picker */}
      <div className="rounded-xl border border-black/[.07] bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-3">Período padrão</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[#6B6A66]">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F6E56]/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[#6B6A66]">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F6E56]/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[#6B6A66]">Mês (repasse)</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F6E56]/40"
            />
          </div>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map((r) => {
          const url = r.buildUrl(from, to, month);
          const isPdf = r.format === "PDF";

          return (
            <div key={r.id} className="rounded-2xl border border-black/[.07] bg-white p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isPdf ? "bg-[#FEF3C7]" : "bg-[#E1F5EE]"}`}>
                  {isPdf
                    ? <FileText className="h-4 w-4 text-amber-600" />
                    : <Table    className="h-4 w-4 text-[#0F6E56]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#0F1A2E]">{r.title}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isPdf ? "bg-amber-50 text-amber-600" : "bg-[#E1F5EE] text-[#0F6E56]"}`}>
                      {r.format}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A09E98] mt-0.5 leading-relaxed">{r.description}</p>
                  {r.needsDateRange && (
                    <p className="text-[10px] text-[#D3D1C7] mt-1">Usa período: {from} → {to}</p>
                  )}
                  {r.needsMonth && (
                    <p className="text-[10px] text-[#D3D1C7] mt-1">Mês: {month}</p>
                  )}
                </div>
              </div>
              <a
                href={url}
                download
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-medium transition ${
                  isPdf
                    ? "bg-[#0B1F3A] text-white hover:bg-black"
                    : "bg-[#E1F5EE] text-[#0F6E56] hover:bg-[#d0f0e6]"
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar {r.format}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
