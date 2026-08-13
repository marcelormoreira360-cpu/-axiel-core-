import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getClinicFeeConfig } from "@/services/fee-decision-service";
import { getClinicCurrency } from "@/services/finance-service";
import { FeePolicyForm } from "./config-client";

export const dynamic = "force-dynamic";

export default async function FeePolicyConfigPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const t = await getTranslations("feeDecisions");
  const [config, currency] = await Promise.all([
    getClinicFeeConfig(clinic.id),
    getClinicCurrency(clinic.id),
  ]);

  return (
    <Shell>
      <BackLink
        fallbackHref="/financeiro/taxas"
        className="inline-flex items-center gap-1.5 text-[12px] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition mb-5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        {t("configBack")}
      </BackLink>

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35 dark:text-white/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">{t("configTitle")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("configSubtitle")}</p>
      </div>

      <FeePolicyForm config={config} currency={currency} />
    </Shell>
  );
}
