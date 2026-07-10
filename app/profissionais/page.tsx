import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { ProfissionaisClient } from "@/components/profissionais-client";

export default async function ProfissionaisPage() {
  const t = await getTranslations("professionals.page");
  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>
      <ProfissionaisClient />
    </Shell>
  );
}
