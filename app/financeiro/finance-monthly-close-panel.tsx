import { getTranslations, getLocale } from "next-intl/server";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { getMonthlyClose } from "@/services/fin-monthly-close-service";
import { formatMoney } from "@/lib/finance-utils";
import { FinanceExportButton } from "./finance-export-button";

// Card de fechamento do mês anterior na home do Financeiro (ERP Fase 6.4).
// Mesmo número que o e-mail mensal automático; botão exporta o PDF.
export async function FinanceMonthlyClosePanel({ clinicId }: { clinicId: string }) {
  const [close, t, locale] = await Promise.all([
    getMonthlyClose(clinicId),
    getTranslations("finance.close"),
    getLocale(),
  ]);
  const money = (c: number) => formatMoney(c, close.currency, locale);
  const monthLabel = new Date(close.year, close.month - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const positive = close.netCents >= 0;

  const items = [
    { label: t("revenue"), value: money(close.revenueCents), icon: <TrendingUp className="h-3.5 w-3.5 text-[#0F6E56]" /> },
    { label: t("expense"), value: money(close.expenseCents), icon: <TrendingDown className="h-3.5 w-3.5 text-[#B42318]" /> },
    { label: t("net"), value: money(close.netCents), icon: <Wallet className={`h-3.5 w-3.5 ${positive ? "text-[#0F6E56]" : "text-[#B42318]"}`} />, tone: positive ? "text-[#0F6E56]" : "text-[#B42318]" },
  ];

  return (
    <div className="mb-5 rounded-[14px] border border-black/[.07] bg-white dark:bg-white/[.02] overflow-hidden">
      <div className="px-[16px] py-[10px] border-b border-black/[.05] flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
          {t("title", { month: monthLabel })}
        </p>
        <FinanceExportButton report="fechamento" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-black/[.05]">
        {items.map((it) => (
          <div key={it.label} className="px-[16px] py-[12px]">
            <div className="flex items-center gap-[6px] mb-[5px]">
              {it.icon}
              <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{it.label}</p>
            </div>
            <p className={`text-[17px] font-semibold tracking-[-0.03em] leading-none ${it.tone ?? "text-[#0F1A2E] dark:text-[#E8E6E2]"}`}>{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
