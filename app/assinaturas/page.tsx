import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { AssinaturasClient } from "@/components/assinaturas-client";

export default async function AssinaturasPage() {
  const t = await getTranslations("assinaturas");
  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          {t("subtitle")}
        </p>
      </div>
      <AssinaturasClient />
    </Shell>
  );
}
