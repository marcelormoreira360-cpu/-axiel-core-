import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPatients } from "@/services/patient-service";
import { redirect } from "next/navigation";
import {
  getFinanceKPIs,
  getPaymentsWithPatients,
  getUnpaidSessions,
  getMonthlyRevenue,
  getPendingPayments,
} from "@/services/finance-service";
import { FinanceiroDashboardClient } from "./financeiro-dashboard-client";
import { ChargeSessionButton } from "./charge-session-button";
import { AsaasChargeButton } from "./asaas-pix-button";
import { isAsaasConfigured } from "@/lib/asaas";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { PendingPayments } from "./pending-payments";
import { FinanceAIPanel } from "./finance-ai-panel";
import { getLatestFinanceInsight } from "@/services/ai-finance-insight-service";
import { getClinicCurrency } from "@/services/finance-service";
import { formatMoney } from "@/lib/finance-utils";

function delta(current: number, previous: number, vsPrev: string) {
  if (previous === 0) return current > 0 ? "+100%" : "—";
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% ${vsPrev}`;
}

const KNOWN_METHODS = ["pix", "boleto", "credit_card", "debit_card", "cash", "transfer", "insurance", "other"];

export default async function FinanceiroPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  const __cur = await getClinicCurrency(clinic?.id ?? "");
  if (!clinic) redirect("/dashboard");

  const t = await getTranslations("finance.page");
  const tm = await getTranslations("finance.methods");
  const locale = await getLocale();
  const asaasPix = isAsaasConfigured();
  const methodLabel = (m: string) => (KNOWN_METHODS.includes(m) ? tm(m) : m);

  const [kpis, payments, unpaid, monthly, patients, cachedInsight, pending] = await Promise.all([
    getFinanceKPIs(clinic.id),
    getPaymentsWithPatients(clinic.id, { limit: 30 }),
    getUnpaidSessions(clinic.id),
    getMonthlyRevenue(clinic.id),
    getPatients(),
    getLatestFinanceInsight(clinic.id),
    getPendingPayments(clinic.id),
  ]);

  // Pendentes têm seção própria; não aparecem na lista de "recentes"
  const confirmedPayments = payments.filter((p) => p.status !== "pending");

  const maxMonthly = Math.max(...monthly.map((m) => m.cents), 1);

  return (
    <Shell>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/financeiro/relatorio"
            className="text-[12px] font-medium text-[#6B6A66] border border-black/[.10] hover:bg-[#F4F3EF] px-3 py-1.5 rounded-lg transition"
          >
            {t("report")}
          </Link>
          <Link
            href="/financeiro/nfse"
            className="text-[12px] font-medium text-[#6B6A66] border border-black/[.10] hover:bg-[#F4F3EF] px-3 py-1.5 rounded-lg transition"
          >
            {t("nfse")}
          </Link>
          <Link
            href="/financeiro/repasse"
            className="text-[12px] font-medium text-[#0F6E56] border border-[#0F6E56]/20 bg-[#E1F5EE] hover:bg-[#d0f0e6] px-3 py-1.5 rounded-lg transition"
          >
            {t("repasse")}
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
            label: t("kpiRevenue"),
            value: formatMoney(kpis.revenueThisMonth, __cur, locale),
            sub: delta(kpis.revenueThisMonth, kpis.revenueLastMonth, t("vsPrev")),
            green: kpis.revenueThisMonth >= kpis.revenueLastMonth,
          },
          {
            label: t("kpiPayments"),
            value: String(kpis.totalPaymentsThisMonth),
            sub: t("thisMonth"),
            green: false,
          },
          {
            label: t("kpiAvgTicket"),
            value: formatMoney(kpis.averageTicketCents, __cur, locale),
            sub: t("perSession"),
            green: false,
          },
          {
            label: t("kpiUnpaid"),
            value: String(unpaid.length),
            sub: unpaid.length > 0 ? t("pending", { amount: formatMoney(unpaid.reduce((s, u) => s + u.price_cents, 0), __cur, locale) }) : t("upToDate"),
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
            <p className="text-[12px] font-medium text-[#0F1A2E] mb-4">{t("revenue6mo")}</p>
            <div className="flex items-end gap-2 h-24">
              {monthly.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-[#0B1F3A] transition-all"
                    style={{ height: `${Math.round((m.cents / maxMonthly) * 80)}px`, minHeight: m.cents > 0 ? "4px" : "0" }}
                    title={formatMoney(m.cents, __cur, locale)}
                  />
                  <p className="text-[9px] text-[#A09E98] capitalize">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pagamentos recentes */}
          <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[.05]">
              <p className="text-[12px] font-medium text-[#0F1A2E]">{t("recentPayments")}</p>
            </div>
            {confirmedPayments.length === 0 ? (
              <p className="px-4 py-6 text-[12px] text-[#A09E98]">{t("noPayments")}</p>
            ) : (
              <div className="divide-y divide-black/[.04]">
                {confirmedPayments.slice(0, 15).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8] transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{p.patient_name ?? "—"}</p>
                      <p className="text-[10px] text-[#A09E98]">
                        {new Date(p.paid_at).toLocaleDateString(locale)}
                        {p.session_type_name ? ` · ${p.session_type_name}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold text-[#0F1A2E]">{formatMoney(p.amount_cents, __cur, locale)}</p>
                      <p className="text-[10px] text-[#A09E98]">{methodLabel(p.payment_method ?? "")}</p>
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
            <p className="text-[12px] font-medium text-[#0F1A2E] mb-3">{t("byMethod")}</p>
            {Object.keys(kpis.revenueThisMonthByMethod).length === 0 ? (
              <p className="text-[11px] text-[#A09E98]">{t("noMethodData")}</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(kpis.revenueThisMonthByMethod)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, cents]) => (
                    <div key={method}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[11px] text-[#6B6A66]">{methodLabel(method)}</p>
                        <p className="text-[11px] font-medium text-[#0F1A2E]">{formatMoney(cents, __cur, locale)}</p>
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
              <p className="text-[12px] font-medium text-[#0F1A2E]">{t("unpaidTitle")}</p>
              {unpaid.length > 0 && (
                <span className="text-[10px] font-medium bg-amber-50 text-amber-600 rounded-full px-2 py-0.5">{unpaid.length}</span>
              )}
            </div>
            {unpaid.length === 0 ? (
              <p className="px-4 py-4 text-[11px] text-[#0F6E56]">{t("allPaid")}</p>
            ) : (
              <div className="divide-y divide-black/[.04] max-h-72 overflow-y-auto">
                {unpaid.slice(0, 10).map((u) => (
                  <FinanceiroUnpaidRow key={u.appointment_id} session={u} locale={locale} currency={__cur} asaasEnabled={asaasPix} />
                ))}
              </div>
            )}
          </div>

          {/* Pagamentos pendentes de conciliação */}
          <PendingPayments payments={pending} locale={locale} />

        </div>
      </div>
    </Shell>
  );
}

// Inline client wrapper just for the "Cobrar" button on each unpaid row
function FinanceiroUnpaidRow({
  session,
  locale,
  currency,
  asaasEnabled,
}: {
  session: import("@/services/finance-service").UnpaidSession;
  locale: string;
  currency: string;
  asaasEnabled: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{session.patient_name}</p>
          <p className="text-[10px] text-[#A09E98]">
            {new Date(session.starts_at).toLocaleDateString(locale)}
            {session.session_type_name ? ` · ${session.session_type_name}` : ""}
          </p>
        </div>
        {session.price_cents > 0 && (
          <p className="shrink-0 text-[12px] font-semibold text-amber-600">{formatMoney(session.price_cents, currency, locale)}</p>
        )}
      </div>
      {session.price_cents > 0 && (
        <div className="mt-1.5 flex items-start justify-end gap-1.5 flex-wrap">
          {asaasEnabled && <AsaasChargeButton appointmentId={session.appointment_id} billingType="PIX" />}
          {asaasEnabled && <AsaasChargeButton appointmentId={session.appointment_id} billingType="BOLETO" />}
          <ChargeSessionButton appointmentId={session.appointment_id} />
        </div>
      )}
    </div>
  );
}
