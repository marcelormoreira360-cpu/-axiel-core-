/**
 * patient-financials-panel.tsx
 *
 * Rollup financeiro do paciente (receita, LTV, ticket, conversão de planos).
 * Apresentacional — dados vêm da view `patient_financials` via
 * getPatientFinancials. ⚠️ Renderizar SOMENTE quando o usuário é gestor
 * (isManager) — a checagem fica na página (ficha do paciente).
 */

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/finance-utils";
import type { PatientFinancials } from "@/services/finance-service";

interface Props {
  financials: PatientFinancials;
  currency: string;
  locale: string;
}

export function PatientFinancialsPanel({ financials, currency, locale }: Props) {
  const t = useTranslations("patientPanels.financials");
  const money = (cents: number) => formatMoney(cents, currency, locale);
  const f = financials;

  const hasActivity = f.payments_count > 0 || f.total_revenue_cents > 0 || f.plans_offered > 0;
  const conversion =
    f.plans_offered > 0 ? Math.round((f.plans_accepted / f.plans_offered) * 100) : null;
  const lastPayment = f.last_payment_at
    ? new Date(f.last_payment_at).toLocaleDateString(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[22px] py-[18px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-[14px]">
        <div>
          <p className="text-[10px] text-[#A09E98] tracking-[.06em] uppercase">{t("eyebrow")}</p>
          <h3 className="text-[15px] font-medium text-[#0F1A2E] tracking-[-0.02em] mt-[2px]">
            {t("title")}
          </h3>
        </div>
        <span className="text-[10px] px-[9px] py-[3px] rounded-full bg-[#F4F3EF] text-[#6B6A66] shrink-0">
          {t("restricted")}
        </span>
      </div>

      {!hasActivity ? (
        <p className="text-[13px] text-[#A09E98]">{t("empty")}</p>
      ) : (
        <>
          {/* Primary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-[14px]">
            <Metric label={t("revenue")} value={money(f.total_revenue_cents)} strong />
            <Metric label={t("ltv")} value={money(f.lifetime_value_cents)} strong />
            <Metric label={t("avgTicket")} value={money(f.average_ticket_cents)} strong />
          </div>

          <div className="h-px bg-black/[.06] dark:bg-white/[.07] my-[14px]" />

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-[14px]">
            <Metric label={t("payments")} value={String(f.payments_count)} />
            <Metric label={t("lastPayment")} value={lastPayment} />
            <Metric
              label={t("plans")}
              value={
                conversion === null
                  ? `${f.plans_accepted}/${f.plans_offered}`
                  : `${f.plans_accepted}/${f.plans_offered} · ${conversion}%`
              }
            />
            {f.pending_cents > 0 && (
              <Metric label={t("pending")} value={money(f.pending_cents)} tone="attention" />
            )}
            {f.refunded_cents > 0 && (
              <Metric label={t("refunded")} value={money(f.refunded_cents)} tone="muted" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  strong = false,
  tone = "default",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "default" | "attention" | "muted";
}) {
  const valueColor =
    tone === "attention" ? "text-[#7C3D04] dark:text-[#E8B04B]" : tone === "muted" ? "text-[#A09E98]" : "text-[#0F1A2E]";
  return (
    <div>
      <p className="text-[10px] text-[#A09E98] tracking-[.04em] uppercase">{label}</p>
      <p className={`${strong ? "text-[18px]" : "text-[14px]"} font-medium ${valueColor} mt-[3px] tracking-[-0.02em]`}>
        {value}
      </p>
    </div>
  );
}
