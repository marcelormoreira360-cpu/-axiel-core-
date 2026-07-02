import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import dynamic from "next/dynamic";

// recharts (~100KB gz) só carrega quando a página abre — mesmo padrão do
// RevenueChart do dashboard.
const FinanceReportClient = dynamic(
  () => import("@/components/finance-report-client").then((m) => m.FinanceReportClient),
  { loading: () => <div className="h-64 animate-pulse bg-black/[.03] dark:bg-white/[.05] rounded-xl" /> },
);

export default async function FinanceReportPage() {
  await (await import("@/lib/require-finance-access")).requireFinanceAccess();
  const t = await getTranslations("finance.report");
  return (
    <Shell>
      <div className="mb-5">
        <Link
          href="/financeiro"
          className="flex items-center gap-1 text-[12px] text-black/40 dark:text-white/40 hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("back")}
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35 dark:text-white/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>

      <FinanceReportClient />
    </Shell>
  );
}
