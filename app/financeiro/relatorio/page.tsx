import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { FinanceReportClient } from "@/components/finance-report-client";

export default async function FinanceReportPage() {
  await (await import("@/lib/require-finance-access")).requireFinanceAccess();
  const t = await getTranslations("finance.report");
  return (
    <Shell>
      <div className="mb-5">
        <Link
          href="/financeiro"
          className="flex items-center gap-1 text-[12px] text-black/40 hover:text-[#0F1A2E] transition mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("back")}
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>

      <FinanceReportClient />
    </Shell>
  );
}
