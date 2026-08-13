import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import {
  drainFeeDecisionEvents,
  drainRetentionEvents,
  getFeeDecisions,
} from "@/services/fee-decision-service";
import { FeeDecisionsClient } from "./taxas-client";

export const dynamic = "force-dynamic";

export default async function TaxasPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const t = await getTranslations("feeDecisions");
  const locale = await getLocale();

  // Drain-on-read (§2.3): materializa as pendências pendentes ao abrir a fila.
  // Idempotente; o cron é a rede de segurança. Retenção drenada junto (barato).
  await drainFeeDecisionEvents(clinic.id);
  await drainRetentionEvents(clinic.id).catch(() => {});

  const [pending, charged, waived] = await Promise.all([
    getFeeDecisions(clinic.id, { state: "pendente_decisao" }),
    getFeeDecisions(clinic.id, { state: "cobrar" }),
    getFeeDecisions(clinic.id, { state: "dispensar" }),
  ]);

  return (
    <Shell>
      <BackLink
        fallbackHref="/financeiro"
        className="inline-flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition mb-5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        {t("back")}
      </BackLink>

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35 dark:text-white/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>

      {/* Aviso: cobrança real depende de consentimento (Lex) + fluxo do Cobro */}
      <div className="mb-5 rounded-[10px] border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 px-4 py-3">
        <p className="text-[11px] text-amber-700 dark:text-amber-300">{t("consentNotice")}</p>
      </div>

      <FeeDecisionsClient
        pending={pending}
        charged={charged}
        waived={waived}
        locale={locale}
      />

      <p className="mt-6 text-[11px] text-[#A09E98]">
        {t("configHint")}{" "}
        <Link href="/financeiro/taxas/config" className="text-[#0F6E56] hover:underline">
          {t("configLink")}
        </Link>
      </p>
    </Shell>
  );
}
