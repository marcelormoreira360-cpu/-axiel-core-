import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Package, CheckCircle2, Hourglass, Gauge } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getProgramsDashboard } from "@/services/fin-programs-service";
import { formatMoney } from "@/lib/finance-utils";

function utilTone(pct: number): string {
  if (pct >= 66) return "text-[#0F6E56]";
  if (pct >= 33) return "text-[#B7791F]";
  return "text-[#B42318]";
}

export default async function ProgramsPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, locale, data] = await Promise.all([
    getTranslations("finance.programs"),
    getLocale(),
    getProgramsDashboard(clinic.id),
  ]);
  const money = (c: number) => formatMoney(c, data.currency, locale);

  const cards = [
    { label: t("activePackages"), value: String(data.activePackages), sub: t("activeSub"), icon: <Package className="h-4 w-4 text-[#0F1A2E]" />, tone: "text-[#0F1A2E]" },
    { label: t("utilization"), value: `${data.utilizationPct}%`, sub: t("utilizationSub", { used: data.usedSessions, sold: data.soldSessions }), icon: <Gauge className="h-4 w-4 text-[#0F6E56]" />, tone: utilTone(data.utilizationPct) },
    { label: t("pending"), value: String(data.pendingSessions), sub: t("pendingSub"), icon: <Hourglass className="h-4 w-4 text-[#B7791F]" />, tone: "text-[#0F1A2E]" },
    { label: t("pendingValue"), value: money(data.pendingValueCents), sub: t("pendingValueSub"), icon: <CheckCircle2 className="h-4 w-4 text-[#B7791F]" />, tone: "text-[#0F1A2E]" },
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

      {/* Por programa */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden mb-[14px]">
        <div className="px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("byProgram")}</p>
        </div>
        {data.rows.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("empty")}</p>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {data.rows.map((r) => (
              <div key={r.name} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F1A2E] truncate">{r.name}</p>
                  <p className="text-[10px] text-[#A09E98]">
                    {t("packagesCount", { count: r.packages })} · {t("usedOfSold", { used: r.usedSessions, sold: r.soldSessions })} · {t("pendingShort", { count: r.pendingSessions })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {r.pendingValueCents != null && <p className="text-[13px] font-medium text-[#0F1A2E]">{money(r.pendingValueCents)}</p>}
                  <p className={`text-[10px] font-medium ${utilTone(r.utilizationPct)}`}>{t("utilPct", { pct: r.utilizationPct })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-[#A09E98]">{t("marginNote")}</p>
    </Shell>
  );
}
