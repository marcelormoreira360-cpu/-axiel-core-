"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Loader2, TrendingUp, Users, CreditCard, BarChart3 } from "lucide-react";
import type { FinanceReportData } from "@/app/api/finance/report/route";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

const PERIODS = [
  { value: "this_month",  label: "Este mês" },
  { value: "last_month",  label: "Mês anterior" },
  { value: "last_3m",     label: "Últimos 3 meses" },
  { value: "last_6m",     label: "Últimos 6 meses" },
  { value: "this_year",   label: "Este ano" },
];

function KpiCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35">{label}</p>
        <Icon className="h-4 w-4 text-black/20" />
      </div>
      <p className="text-[24px] font-semibold tracking-[-0.03em] text-[#0F1A2E]">{value}</p>
      {sub && <p className="text-[11px] text-black/40 mt-1">{sub}</p>}
    </div>
  );
}

function exportCSV(data: FinanceReportData) {
  const header = ["Data", "Paciente", "Tipo de sessão", "Forma de pagamento", "Valor (R$)", "Observações"];
  const rows = data.payments.map((p) => [
    formatDate(p.paidAt),
    p.patientName,
    p.sessionTypeName,
    p.method,
    (p.amountCents / 100).toFixed(2).replace(".", ","),
    p.notes ?? "",
  ]);

  const csvContent = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const BOM = "﻿"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `financeiro_${data.period.label.replace(/\s/g, "_")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function FinanceReportClient() {
  const [period, setPeriod] = useState("this_month");
  const [data, setData] = useState<FinanceReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/report?period=${period}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const maxTypeRevenue = Math.max(...(data?.bySessionType.map((t) => t.totalCents) ?? [1]), 1);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
              {p.label}
            </button>
          ))}
        </div>
        {data && data.paymentCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV(data)}
              className="flex items-center gap-1.5 rounded-xl border border-black/[.10] px-3 py-1.5 text-[12px] font-medium text-black/60 hover:bg-black/[.04] transition"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <a
              href={`/api/finance/report/pdf?period=${period}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-black/[.10] px-3 py-1.5 text-[12px] font-medium text-black/60 hover:bg-black/[.04] transition"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </a>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-black/30" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-sm text-black/40">Erro ao carregar relatório.</div>
      ) : (
        <>
          {/* Period label */}
          <p className="text-[13px] font-medium text-black/50 capitalize">{data.period.label}</p>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Receita total"
              value={formatBRL(data.totalRevenueCents)}
              icon={TrendingUp}
            />
            <KpiCard
              label="Pagamentos"
              value={String(data.paymentCount)}
              icon={CreditCard}
            />
            <KpiCard
              label="Ticket médio"
              value={formatBRL(data.avgTicketCents)}
              icon={BarChart3}
            />
            <KpiCard
              label="Pacientes únicos"
              value={String(data.topPatients.length)}
              icon={Users}
            />
          </div>

          {data.paymentCount === 0 ? (
            <div className="bg-white rounded-2xl border border-black/[.07] p-10 text-center">
              <p className="text-sm font-medium text-[#0F1A2E]">Nenhum pagamento neste período</p>
              <p className="text-xs text-black/40 mt-1">Selecione outro período ou registre pagamentos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Revenue by session type */}
              <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35">
                  Receita por tipo de sessão
                </p>
                <div className="space-y-2.5">
                  {data.bySessionType.map((t) => {
                    const pct = Math.round((t.totalCents / data.totalRevenueCents) * 100);
                    const barPct = Math.round((t.totalCents / maxTypeRevenue) * 100);
                    return (
                      <div key={t.sessionTypeId ?? "none"}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[12px] font-medium text-[#0F1A2E] truncate max-w-[55%]">
                            {t.sessionTypeName}
                          </span>
                          <span className="text-[12px] text-black/60 shrink-0">
                            {formatBRL(t.totalCents)}
                            <span className="text-black/35 ml-1">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/[.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0F6E56] transition-all duration-500"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-black/35 mt-0.5">
                          {t.count} pagamento{t.count !== 1 ? "s" : ""} · ticket médio {formatBRL(t.avgTicketCents)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top patients */}
              <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35">
                  Top pacientes por receita
                </p>
                <div className="space-y-2">
                  {data.topPatients.slice(0, 8).map((p, i) => {
                    const pct = Math.round((p.totalCents / data.totalRevenueCents) * 100);
                    return (
                      <div key={p.patientId} className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-black/25 w-4 text-right shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[12px] font-medium text-[#0F1A2E] truncate">{p.patientName}</span>
                            <span className="text-[12px] text-black/60 shrink-0 ml-2">{formatBRL(p.totalCents)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex-1 h-1 rounded-full bg-black/[.06]">
                              <div
                                className="h-full rounded-full bg-[#0F6E56]/50"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-black/30 shrink-0">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Payments table */}
          {data.paymentCount > 0 && (
            <div className="bg-white rounded-2xl border border-black/[.07] overflow-hidden">
              <div className="px-5 py-4 border-b border-black/[.06] flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35">
                  Histórico de pagamentos
                </p>
                <span className="text-[11px] text-black/35">{data.paymentCount} registros</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-black/[.05]">
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35">Data</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35">Paciente</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 hidden sm:table-cell">Tipo de sessão</th>
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 hidden md:table-cell">Pagamento</th>
                      <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.08em] text-black/35">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id} className="border-b border-black/[.04] hover:bg-black/[.02] transition">
                        <td className="px-5 py-3 text-black/55 whitespace-nowrap">{formatDate(p.paidAt)}</td>
                        <td className="px-5 py-3 font-medium text-[#0F1A2E]">{p.patientName}</td>
                        <td className="px-5 py-3 text-black/55 hidden sm:table-cell">{p.sessionTypeName}</td>
                        <td className="px-5 py-3 text-black/55 hidden md:table-cell">{p.method}</td>
                        <td className="px-5 py-3 text-right font-semibold text-[#0F1A2E]">
                          {formatBRL(p.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-black/[.02]">
                      <td colSpan={4} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[.08em] text-black/40">
                        Total
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-[#0F1A2E]">
                        {formatBRL(data.totalRevenueCents)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
