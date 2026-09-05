import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Percent, Users, Package, TrendingUp, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { FinanceExportButton } from "../finance-export-button";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getMarginDashboard } from "@/services/fin-margin-service";
import { formatMoney } from "@/lib/finance-utils";

function pctTone(pct: number): string {
  if (pct >= 60) return "text-[#0F6E56]";
  if (pct >= 30) return "text-[#B7791F]";
  return "text-[#B42318]";
}

export default async function MarginPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, locale, data] = await Promise.all([
    getTranslations("finance.margin"),
    getLocale(),
    getMarginDashboard(clinic.id),
  ]);
  const money = (c: number) => formatMoney(c, data.currency, locale);
  const monthLabel = new Date(data.periodMonth + "-01T12:00:00").toLocaleDateString(locale, { month: "long", year: "numeric" });

  const cards = [
    { label: t("totalMargin"), value: money(data.totalMarginCents), sub: t("totalMarginSub"), icon: <TrendingUp className="h-4 w-4 text-[#0F6E56]" />, tone: "text-[#0F6E56]" },
    { label: t("servicesMargin"), value: money(data.servicesMarginCents), sub: t("marginOf", { pct: data.servicesMarginPct }), icon: <Users className="h-4 w-4 text-[#0F1A2E]" />, tone: "text-[#0F1A2E]" },
    { label: t("productsMargin"), value: money(data.productsMarginCents), sub: t("marginOf", { pct: data.productsMarginPct }), icon: <Package className="h-4 w-4 text-[#0F1A2E]" />, tone: "text-[#0F1A2E]" },
    { label: t("repasse"), value: money(data.servicesRepasseCents), sub: t("repasseSub"), icon: <Percent className="h-4 w-4 text-[#B7791F]" />, tone: "text-[#0F1A2E]" },
  ];

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3 mb-[6px]">
        <div className="flex items-center gap-[10px]">
          <BackLink fallbackHref="/financeiro" className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition">‹</BackLink>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">{t("eyebrow")}</p>
            <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
          </div>
        </div>
        <FinanceExportButton report="margem" />
      </div>
      <p className="text-[12px] text-[#A09E98] mb-[18px]">{t("subtitle", { month: monthLabel })}</p>

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

      {/* Margem por profissional */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden mb-[16px]">
        <div className="px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("byProfessional")}</p>
          <p className="text-[10px] text-[#A09E98] mt-[2px]">{t("byProfessionalHint")}</p>
        </div>
        {data.professionals.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("noServices")}</p>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {data.professionals.map((p) => (
              <div key={p.userId} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F1A2E] truncate">{p.name}</p>
                  <p className="text-[10px] text-[#A09E98]">
                    {t("sessions", { count: p.sessions })} · {t("gross")} {money(p.grossCents)} · {t("repasse")} {money(p.repasseCents)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-medium text-[#0F6E56]">{money(p.marginCents)}</p>
                  <p className={`text-[10px] font-medium ${pctTone(p.marginPct)}`}>{t("marginPct", { pct: p.marginPct })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Margem por produto */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden mb-[16px]">
        <div className="px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("byProduct")}</p>
        </div>
        {data.products.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("noProducts")}</p>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {data.products.map((p) => (
              <div key={p.productId ?? p.name} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F1A2E] truncate">{p.name}</p>
                  <p className="text-[10px] text-[#A09E98]">
                    {t("units", { count: p.units })} · {t("revenue")} {money(p.revenueCents)}
                    {p.costKnown ? ` · ${t("cost")} ${money(p.costCents)}` : ` · ${t("noCost")}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-medium text-[#0F6E56]">{money(p.marginCents)}</p>
                  {p.costKnown && <p className={`text-[10px] font-medium ${pctTone(p.marginPct)}`}>{t("marginPct", { pct: p.marginPct })}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ponteiros: Clínica (analytics) e Programas (fase futura) */}
      <div className="flex flex-wrap items-center gap-[8px]">
        <Link href="/analytics" className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] rounded-[8px] px-[12px] py-[8px] transition">
          {t("clinicLink")} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <p className="text-[11px] text-[#A09E98]">{t("programsNote")}</p>
      </div>
    </Shell>
  );
}
