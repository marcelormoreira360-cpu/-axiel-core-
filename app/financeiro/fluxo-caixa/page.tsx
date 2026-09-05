import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCashFlow } from "@/services/fin-ledger-service";
import { formatMoney } from "@/lib/finance-utils";

function monthLabel(key: string, locale: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

export default async function CashFlowPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, locale, data] = await Promise.all([
    getTranslations("finance.cashflow"),
    getLocale(),
    getCashFlow(clinic.id),
  ]);
  const money = (c: number) => formatMoney(c, data.currency, locale);
  const maxAbs = Math.max(1, ...data.months.map((m) => Math.max(m.inCents, m.outCents)));
  const netPositive = data.totalNet >= 0;

  const totals = [
    { label: t("in"), value: money(data.totalIn), icon: <ArrowUpRight className="h-4 w-4 text-[#0F6E56]" />, tone: "text-[#0F6E56]" },
    { label: t("out"), value: money(data.totalOut), icon: <ArrowDownRight className="h-4 w-4 text-[#B42318]" />, tone: "text-[#B42318]" },
    { label: t("net"), value: money(data.totalNet), icon: <Wallet className={`h-4 w-4 ${netPositive ? "text-[#0F6E56]" : "text-[#B42318]"}`} />, tone: netPositive ? "text-[#0F6E56]" : "text-[#B42318]" },
  ];

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[6px]">
        <BackLink fallbackHref="/financeiro" className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition">‹</BackLink>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">{t("eyebrow")}</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        </div>
      </div>
      <p className="text-[12px] text-[#A09E98] mb-[18px]">{t("subtitle")}</p>

      {/* Totais 6 meses */}
      <div className="grid grid-cols-3 gap-[10px] mb-[16px]">
        {totals.map((c) => (
          <div key={c.label} className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
            <div className="flex items-center justify-between mb-[8px]">
              <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{c.label}</p>
              {c.icon}
            </div>
            <p className={`text-[18px] font-semibold tracking-[-0.03em] leading-none ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Por mês */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
        <div className="px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("byMonth")}</p>
        </div>
        <div className="divide-y divide-black/[.04]">
          {data.months.map((m) => (
            <div key={m.month} className="px-[16px] py-[12px]">
              <div className="flex items-center justify-between mb-[6px]">
                <p className="text-[12px] font-medium text-[#0F1A2E] capitalize">{monthLabel(m.month, locale)}</p>
                <p className={`text-[12px] font-medium ${m.netCents >= 0 ? "text-[#0F6E56]" : "text-[#B42318]"}`}>
                  {m.netCents >= 0 ? "+" : "−"}{money(Math.abs(m.netCents))}
                </p>
              </div>
              <div className="flex items-center gap-[8px]">
                <div className="flex-1 h-1.5 rounded-full bg-[#E1F5EE] overflow-hidden">
                  <div className="h-full bg-[#0F6E56] rounded-full" style={{ width: `${Math.round((m.inCents / maxAbs) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-[#0F6E56] w-[80px] text-right shrink-0">{money(m.inCents)}</span>
              </div>
              <div className="flex items-center gap-[8px] mt-[3px]">
                <div className="flex-1 h-1.5 rounded-full bg-[#FBEAE8] overflow-hidden">
                  <div className="h-full bg-[#B42318] rounded-full" style={{ width: `${Math.round((m.outCents / maxAbs) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-[#B42318] w-[80px] text-right shrink-0">{money(m.outCents)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-[#A09E98] mt-[10px]">{t("legend")}</p>
    </Shell>
  );
}
