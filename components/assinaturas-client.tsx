"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, CreditCard, AlertCircle, CheckCircle2, PauseCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import type { PatientSubscriptionRow } from "@/app/api/subscriptions/route";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatBRL(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactElement; bg: string; text: string }
> = {
  active:    { label: "Ativo",     icon: <CheckCircle2 className="h-3.5 w-3.5" />, bg: "#F0FAF5", text: "#0F6E56" },
  trialing:  { label: "Teste",     icon: <Clock className="h-3.5 w-3.5" />,        bg: "#EFF6FF", text: "#3B82F6" },
  past_due:  { label: "Em atraso", icon: <AlertCircle className="h-3.5 w-3.5" />,  bg: "#FFFBEB", text: "#D97706" },
  paused:    { label: "Pausado",   icon: <PauseCircle className="h-3.5 w-3.5" />,  bg: "#F9FAFB", text: "#6B7280" },
  canceled:  { label: "Cancelado", icon: <XCircle className="h-3.5 w-3.5" />,      bg: "#FEF2F2", text: "#DC2626" },
  incomplete: { label: "Incompleto", icon: <AlertCircle className="h-3.5 w-3.5" />, bg: "#FFFBEB", text: "#D97706" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.incomplete;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.1em] px-2 py-1 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

type Stats = { total: number; activeCount: number; pastDueCount: number; mrr: number };

export function AssinaturasClient() {
  const [rows, setRows] = useState<PatientSubscriptionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "past_due" | "canceled">("all");

  const fetchData = useCallback(async () => {
    const url = filter === "all" ? "/api/subscriptions" : `/api/subscriptions?status=${filter}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json() as { rows: PatientSubscriptionRow[]; stats: Stats };
      setRows(json.rows);
      setStats(json.stats);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total",          value: String(stats.total),       icon: CreditCard, color: "#0F1A2E" },
            { label: "Ativos",         value: String(stats.activeCount), icon: CheckCircle2, color: "#0F6E56" },
            { label: "Em atraso",      value: String(stats.pastDueCount), icon: AlertCircle, color: "#D97706" },
            { label: "MRR estimado",   value: formatBRL(stats.mrr),      icon: CreditCard, color: "#3B82F6" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-black/[.07] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/30">{label}</p>
                <Icon className="h-3.5 w-3.5" style={{ color }} />
              </div>
              <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F1A2E]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "active", "past_due", "canceled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "px-3 py-1.5 rounded-lg text-[12px] font-medium transition",
              filter === f
                ? "bg-[#0F1A2E] text-white"
                : "bg-white border border-black/[.10] text-black/60 hover:bg-black/[.04]",
            ].join(" ")}
          >
            {{ all: "Todos", active: "Ativos", past_due: "Em atraso", canceled: "Cancelados" }[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/[.07] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-black/25" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-14">
            <CreditCard className="h-8 w-8 text-black/15 mx-auto mb-3" />
            <p className="text-[13px] text-black/35">Nenhuma assinatura encontrada.</p>
            <p className="text-[12px] text-black/25 mt-1">
              Crie ofertas do tipo &quot;Plano Mensal&quot; em{" "}
              <Link href="/monetization" className="underline hover:text-[#0F6E56]">
                Planos e pacotes
              </Link>
              {" "}para começar.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-black/[.05] text-[10px] font-semibold uppercase tracking-[.12em] text-black/30">
              <span>Paciente</span>
              <span>Plano</span>
              <span>Valor</span>
              <span>Renova em</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-black/[.04]">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-2 md:gap-4 px-5 py-4 items-center"
                >
                  {/* Patient */}
                  <div>
                    <Link
                      href={`/patients/${row.patientId}`}
                      className="text-[13px] font-medium text-[#0F1A2E] hover:text-[#0F6E56] transition-colors"
                    >
                      {row.patientName}
                    </Link>
                  </div>

                  {/* Plan */}
                  <div>
                    <p className="text-[12px] text-[#0F1A2E]">{row.planName}</p>
                    <p className="text-[11px] text-black/35">
                      {row.billingInterval === "yearly" ? "Anual" : "Mensal"}
                      {row.sessionsPerCycle > 0 && ` · ${row.sessionsPerCycle} sessões/ciclo`}
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <p className="text-[13px] font-medium text-[#0F1A2E]">
                      {formatBRL(row.amountCents, row.currency)}
                    </p>
                  </div>

                  {/* Period end */}
                  <div>
                    <p className={[
                      "text-[12px]",
                      row.cancelAtPeriodEnd ? "text-amber-500" : "text-black/45",
                    ].join(" ")}>
                      {row.cancelAtPeriodEnd ? "⚠️ " : ""}{formatDate(row.currentPeriodEnd)}
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={row.status} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tip */}
      <p className="text-[11px] text-black/25 text-center">
        Assinaturas gerenciadas via Stripe. Cancelamentos e reembolsos devem ser feitos no painel do Stripe.
      </p>
    </div>
  );
}
