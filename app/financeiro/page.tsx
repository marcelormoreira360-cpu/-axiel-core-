import Link from "next/link";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPatients } from "@/services/patient-service";
import { redirect } from "next/navigation";
import {
  getFinanceKPIs,
  getPaymentsWithPatients,
  getUnpaidSessions,
  getMonthlyRevenue,
  formatBRL,
  paymentMethodLabel,
} from "@/services/finance-service";
import { FinanceiroDashboardClient } from "./financeiro-dashboard-client";
import { FinanceAIPanel } from "./finance-ai-panel";
import { getLatestFinanceInsight } from "@/services/ai-finance-insight-service";

function delta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "+100%" : "—";
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}% vs. mês anterior` : `${pct}% vs. mês anterior`;
}

export default async function FinanceiroPage() {
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [kpis, payments, unpaid, monthly, patients, cachedInsight] = await Promise.all([
    getFinanceKPIs(clinic.id),
    getPaymentsWithPatients(clinic.id, { limit: 30 }),
    getUnpaidSessions(clinic.id),
    getMonthlyRevenue(clinic.id),
    getPatients(),
    getLatestFinanceInsight(clinic.id),
  ]);

  const maxMonthly = Math.max(...monthly.map((m) => m.cents), 1);

  return (
    <Shell>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Módulo</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Financeiro</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">Faturamento, pagamentos e repasse médico.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/financeiro/nfse"
            className="text-[12px] font-medium text-[#6B6A66] border border-black/[.10] hover:bg-[#F4F3EF] px-3 py-1.5 rounded-lg transition"
          >
            NFS-e →
          </Link>
          <Link
            href="/financeiro/repasse"
            className="text-[12px] font-medium text-[#0F6E56] border border-[#0F6E56]/20 bg-[#E1F5EE] hover:bg-[#d0f0e6] px-3 py-1.5 rounded-lg transition"
          >
            Repasse médico →
          </Link>
          <FinanceiroDashboardClient
            patients={patients.map((p) => ({ id: p.id, full_name: p.full_name }))}
          />
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-5">
        {[
          {
            label: "RECEITA DO MÊS",
            value: formatBRL(kpis.revenueThisMonth),
            sub: delta(kpis.revenueThisMonth, kpis.revenueLastMonth),
            green: kpis.revenueThisMonth >= kpis.revenueLastMonth,
          },
          {
            label: "PAGAMENTOS RECEBIDOS",
            value: String(kpis.totalPaymentsThisMonth),
            sub: "este mês",
            green: false,
          },
          {
            label: "TICKET MÉDIO",
            value: formatBRL(kpis.averageTicketCents),
            sub: "por sessão este mês",
            green: false,
          },
          {
            label: "SESSÕES NÃO PAGAS",
            value: String(unpaid.length),
            sub: unpaid.length > 0 ? `~${formatBRL(unpaid.reduce((s, u) => s + u.price_cents, 0))} pendente` : "tudo em dia",
            green: unpaid.length === 0,
          },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-black/[.07] rounded-[10px] p-[13px]">
            <p className="text-[10px] text-[#A09E98] tracking-[.04em] mb-[5px]">{m.label}</p>
            <p className="text-[22px] font-semibold tracking-[-0.03em] text-[#0F1A2E] leading-none">{m.value}</p>
            <p className={`text-[10px] mt-[3px] ${m.green ? "text-[#0F6E56]" : "text-[#A09E98]"}`}>{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

        {/* Left column */}
        <div className="space-y-4">

          {/* Receita últimos 6 meses */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-[16px]">
            <p className="text-[12px] font-medium text-[#0F1A2E] mb-4">Receita — últimos 6 meses</p>
            <div className="flex items-end gap-2 h-24">
              {monthly.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-[#0B1F3A] transition-all"
                    style={{ height: `${Math.round((m.cents / maxMonthly) * 80)}px`, minHeight: m.cents > 0 ? "4px" : "0" }}
                    title={formatBRL(m.cents)}
                  />
                  <p className="text-[9px] text-[#A09E98] capitalize">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pagamentos recentes */}
          <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[.05]">
              <p className="text-[12px] font-medium text-[#0F1A2E]">Pagamentos recentes</p>
            </div>
            {payments.length === 0 ? (
              <p className="px-4 py-6 text-[12px] text-[#A09E98]">Nenhum pagamento registrado ainda.</p>
            ) : (
              <div className="divide-y divide-black/[.04]">
                {payments.slice(0, 15).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8] transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{p.patient_name ?? "—"}</p>
                      <p className="text-[10px] text-[#A09E98]">
                        {new Date(p.paid_at).toLocaleDateString("pt-BR")}
                        {p.session_type_name ? ` · ${p.session_type_name}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold text-[#0F1A2E]">{formatBRL(p.amount_cents)}</p>
                      <p className="text-[10px] text-[#A09E98]">{paymentMethodLabel(p.payment_method)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Análise IA */}
          <FinanceAIPanel initial={cachedInsight} />

          {/* Por forma de pagamento */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-4">
            <p className="text-[12px] font-medium text-[#0F1A2E] mb-3">Por forma de pagamento</p>
            {Object.keys(kpis.revenueThisMonthByMethod).length === 0 ? (
              <p className="text-[11px] text-[#A09E98]">Nenhum dado este mês.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(kpis.revenueThisMonthByMethod)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, cents]) => (
                    <div key={method}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[11px] text-[#6B6A66]">{paymentMethodLabel(method as never)}</p>
                        <p className="text-[11px] font-medium text-[#0F1A2E]">{formatBRL(cents)}</p>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#F4F3EF]">
                        <div
                          className="h-1.5 rounded-full bg-[#0B1F3A]"
                          style={{ width: `${Math.round((cents / kpis.revenueThisMonth) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Sessões não pagas */}
          <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[.05]">
              <p className="text-[12px] font-medium text-[#0F1A2E]">Sessões não pagas</p>
              {unpaid.length > 0 && (
                <span className="text-[10px] font-medium bg-amber-50 text-amber-600 rounded-full px-2 py-0.5">{unpaid.length}</span>
              )}
            </div>
            {unpaid.length === 0 ? (
              <p className="px-4 py-4 text-[11px] text-[#0F6E56]">✓ Todas as sessões foram pagas.</p>
            ) : (
              <div className="divide-y divide-black/[.04] max-h-72 overflow-y-auto">
                {unpaid.slice(0, 10).map((u) => (
                  <FinanceiroUnpaidRow key={u.appointment_id} session={u} patients={patients.map((p) => ({ id: p.id, full_name: p.full_name }))} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </Shell>
  );
}

// Inline client wrapper just for the "Cobrar" button on each unpaid row
function FinanceiroUnpaidRow({
  session,
  patients,
}: {
  session: import("@/services/finance-service").UnpaidSession;
  patients: { id: string; full_name: string }[];
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{session.patient_name}</p>
        <p className="text-[10px] text-[#A09E98]">
          {new Date(session.starts_at).toLocaleDateString("pt-BR")}
          {session.session_type_name ? ` · ${session.session_type_name}` : ""}
        </p>
      </div>
      <div className="text-right">
        {session.price_cents > 0 && (
          <p className="text-[12px] font-semibold text-amber-600">{formatBRL(session.price_cents)}</p>
        )}
      </div>
    </div>
  );
}
