import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Repeat, TrendingUp, Users, AlertCircle, FlaskConical, Pill, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getRecurringDashboard } from "@/services/fin-saas-service";
import { formatMoney } from "@/lib/finance-utils";

export default async function RecurringPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, locale, data] = await Promise.all([
    getTranslations("finance.recurring"),
    getLocale(),
    getRecurringDashboard(clinic.id),
  ]);
  const money = (c: number) => formatMoney(c, data.currency, locale);
  const { saas, attach } = data;

  const cards = [
    { label: t("mrr"), value: money(saas.mrrCents), sub: t("mrrSub"), icon: <Repeat className="h-4 w-4 text-[#0F6E56]" />, tone: "text-[#0F6E56]" },
    { label: t("arr"), value: money(saas.arrCents), sub: t("arrSub"), icon: <TrendingUp className="h-4 w-4 text-[#0F1A2E]" />, tone: "text-[#0F1A2E]" },
    { label: t("active"), value: String(saas.activeCount), sub: t("activeSub"), icon: <Users className="h-4 w-4 text-[#0F1A2E]" />, tone: "text-[#0F1A2E]" },
    { label: t("trialing"), value: String(saas.trialingCount), sub: saas.pastDueCount > 0 ? t("pastDue", { count: saas.pastDueCount }) : t("trialingSub"), icon: <AlertCircle className={`h-4 w-4 ${saas.pastDueCount > 0 ? "text-[#B42318]" : "text-[#B7791F]"}`} />, tone: "text-[#0F1A2E]" },
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

      {/* SaaS / MRR cards */}
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

      {/* MRR por plano */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden mb-[20px]">
        <div className="px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("byPlan")}</p>
        </div>
        {saas.byPlan.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("noSubs")}</p>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {saas.byPlan.map((p) => (
              <div key={p.plan} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F1A2E] truncate">{p.plan}</p>
                  <p className="text-[10px] text-[#A09E98]">{t("subscribers", { count: p.subscribers })}</p>
                </div>
                <p className="text-[13px] font-medium text-[#0F6E56] shrink-0">{money(p.mrrCents)}<span className="text-[10px] text-[#A09E98] font-normal">{t("perMonth")}</span></p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exames & Suplementos — engajamento / attach */}
      <div className="flex items-center gap-[8px] mb-[10px]">
        <p className="text-[13px] font-semibold text-[#0F1A2E]">{t("attachTitle")}</p>
        <span className="text-[10px] text-[#A09E98]">{t("attachTag")}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[12px]">
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <div className="flex items-center justify-between mb-[8px]">
            <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{t("exams")}</p>
            <FlaskConical className="h-4 w-4 text-[#0F1A2E]" />
          </div>
          <p className="text-[20px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{attach.examsThisMonth}</p>
          <p className="text-[10px] text-[#A09E98] mt-[5px]">{t("examsSub")}</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <div className="flex items-center justify-between mb-[8px]">
            <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{t("recsSent")}</p>
            <Pill className="h-4 w-4 text-[#0F1A2E]" />
          </div>
          <p className="text-[20px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{attach.recsSentThisMonth}</p>
          <p className="text-[10px] text-[#A09E98] mt-[5px]">{t("recsSentSub", { total: attach.recsThisMonth })}</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <div className="flex items-center justify-between mb-[8px]">
            <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{t("attachRate")}</p>
            <TrendingUp className="h-4 w-4 text-[#0F6E56]" />
          </div>
          <p className="text-[20px] font-semibold tracking-[-0.03em] leading-none text-[#0F6E56]">{attach.attachRatePct}%</p>
          <p className="text-[10px] text-[#A09E98] mt-[5px]">{t("attachRateSub", { rec: attach.patientsWithRec, exam: attach.patientsWithExam })}</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px] flex flex-col justify-between">
          <p className="text-[10px] text-[#A09E98]">{t("productRevenueNote")}</p>
          <Link href="/financeiro/margem" className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition mt-[6px]">
            {t("seeMargin")} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {attach.examsByType.length > 0 && (
        <p className="text-[11px] text-[#A09E98]">
          {t("examsByTypeLabel")}{" "}
          {attach.examsByType.map((e, i) => (
            <span key={e.type}>{i > 0 ? " · " : ""}{e.type} ({e.count})</span>
          ))}
        </p>
      )}
    </Shell>
  );
}
