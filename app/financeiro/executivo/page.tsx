import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Trash2, TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { SubmitButton } from "@/components/submit-button";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getExecutiveSummary, listFinEntries } from "@/services/fin-ledger-service";
import { formatMoney } from "@/lib/finance-utils";
import { AddFinEntryForm } from "./executivo-form";
import { deleteFinEntryAction } from "./actions";

function pctDelta(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? "+100%" : "—";
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

export default async function FinanceExecutivePage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, locale, summary, entries] = await Promise.all([
    getTranslations("finance.executive"),
    getLocale(),
    getExecutiveSummary(clinic.id),
    listFinEntries(clinic.id, { limit: 30 }),
  ]);

  const money = (c: number) => formatMoney(c, summary.currency, locale);
  const netPositive = summary.netCents >= 0;

  const cards = [
    { label: t("revenue"), value: money(summary.revenueCents), sub: `${pctDelta(summary.revenueCents, summary.revenuePrevCents)} ${t("vsPrev")}`, icon: <TrendingUp className="h-4 w-4 text-[#0F6E56]" />, tone: "text-[#0F1A2E]" },
    { label: t("expense"), value: money(summary.expenseCents), sub: t("expenseSub"), icon: <TrendingDown className="h-4 w-4 text-[#B42318]" />, tone: "text-[#0F1A2E]" },
    { label: t("net"), value: money(summary.netCents), sub: netPositive ? t("netPositive") : t("netNegative"), icon: <Wallet className={`h-4 w-4 ${netPositive ? "text-[#0F6E56]" : "text-[#B42318]"}`} />, tone: netPositive ? "text-[#0F6E56]" : "text-[#B42318]" },
    { label: t("receivable"), value: money(summary.receivableCents), sub: t("receivableSub"), icon: <Clock className="h-4 w-4 text-[#B7791F]" />, tone: "text-[#0F1A2E]" },
  ];

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[6px]">
        <BackLink fallbackHref="/financeiro" className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition">
          ‹
        </BackLink>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">{t("eyebrow")}</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        </div>
      </div>
      <p className="text-[12px] text-[#A09E98] mb-[18px]">{t("subtitle")}</p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[16px]">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
            <div className="flex items-center justify-between mb-[8px]">
              <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{c.label}</p>
              {c.icon}
            </div>
            <p className={`text-[20px] font-semibold tracking-[-0.03em] leading-none ${c.tone}`}>{c.value}</p>
            <p className="text-[10px] text-[#A09E98] mt-[5px]">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Add entry */}
      <div className="mb-[16px]">
        <AddFinEntryForm />
      </div>

      {/* Entries list */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
        <div className="px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("entriesTitle")}</p>
        </div>
        {entries.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("empty")}</p>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.kind === "revenue" ? "bg-[#0F6E56]" : "bg-[#B42318]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F1A2E] truncate">
                    {e.description || e.category || (e.kind === "revenue" ? t("kindRevenue") : t("kindExpense"))}
                  </p>
                  <p className="text-[10px] text-[#A09E98]">
                    {new Date(e.entry_date + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    {e.category ? ` · ${e.category}` : ""}
                    {e.source !== "manual" ? ` · ${e.source}` : ""}
                  </p>
                </div>
                <p className={`text-[13px] font-medium shrink-0 ${e.kind === "revenue" ? "text-[#0F6E56]" : "text-[#B42318]"}`}>
                  {e.kind === "revenue" ? "+" : "−"}{money(e.amount_cents)}
                </p>
                {e.source === "manual" && (
                  <form action={deleteFinEntryAction.bind(null, e.id)}>
                    <SubmitButton className="w-6 h-6 flex items-center justify-center rounded-md text-[#A09E98] hover:text-[#B42318] hover:bg-[#B42318]/[.06] disabled:opacity-70 transition shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </SubmitButton>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
