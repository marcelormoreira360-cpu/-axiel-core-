import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { AlertTriangle, AlertCircle, ChevronRight } from "lucide-react";
import { getClinicCurrency } from "@/services/finance-service";
import { getFinanceAlerts, type FinAlert } from "@/services/fin-alerts-service";
import { formatMoney } from "@/lib/finance-utils";

// Painel de alertas na home do Financeiro. Server component: busca os alertas e
// só renderiza quando há algo a mostrar (zero ruído quando está tudo em dia).
export async function FinanceAlertsPanel({ clinicId }: { clinicId: string }) {
  const [alerts, t, locale, currency] = await Promise.all([
    getFinanceAlerts(clinicId),
    getTranslations("finance.alerts"),
    getLocale(),
    getClinicCurrency(clinicId),
  ]);
  if (alerts.length === 0) return null;

  const money = (c: number) => formatMoney(Math.abs(c), currency, locale);

  const message = (a: FinAlert): string =>
    t(a.key, {
      count: a.count ?? 0,
      amount: a.amountCents != null ? money(a.amountCents) : "",
    });

  return (
    <div className="mb-5 rounded-[14px] border border-[#B7791F]/25 bg-[#FBF7EE] dark:bg-[#B7791F]/[.06] overflow-hidden">
      <div className="px-[16px] py-[10px] border-b border-[#B7791F]/15 flex items-center gap-[8px]">
        <AlertTriangle className="h-3.5 w-3.5 text-[#B7791F]" />
        <p className="text-[12px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title", { count: alerts.length })}</p>
      </div>
      <div className="divide-y divide-[#B7791F]/10">
        {alerts.map((a) => {
          const danger = a.level === "danger";
          return (
            <Link
              key={a.key}
              href={a.href}
              className="flex items-center gap-[10px] px-[16px] py-[10px] hover:bg-black/[.02] dark:hover:bg-white/[.03] transition group"
            >
              {danger ? (
                <AlertCircle className="h-3.5 w-3.5 text-[#B42318] shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-[#B7791F] shrink-0" />
              )}
              <p className={`text-[13px] flex-1 min-w-0 ${danger ? "text-[#B42318]" : "text-[#0F1A2E] dark:text-[#E8E6E2]"}`}>
                {message(a)}
              </p>
              <ChevronRight className="h-3.5 w-3.5 text-[#A09E98] group-hover:text-[#0F1A2E] transition shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
