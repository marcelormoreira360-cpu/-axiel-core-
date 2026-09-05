import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Clock } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { requireFinanceAccess } from "@/lib/require-finance-access";
import { getCurrentClinic } from "@/services/clinic-service";
import { getReceivables } from "@/services/fin-ledger-service";
import { formatMoney } from "@/lib/finance-utils";

export default async function ReceivablesPage() {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [t, locale, data] = await Promise.all([
    getTranslations("finance.receivables"),
    getLocale(),
    getReceivables(clinic.id),
  ]);
  const money = (c: number) => formatMoney(c, data.currency, locale);

  const buckets = [
    { label: t("bucket0"), value: data.buckets.d0_30 },
    { label: t("bucket31"), value: data.buckets.d31_60, warn: true },
    { label: t("bucket61"), value: data.buckets.d61_90, warn: true },
    { label: t("bucket90"), value: data.buckets.d90p, danger: true },
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

      {/* Total + aging */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[16px]">
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <div className="flex items-center justify-between mb-[8px]">
            <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{t("total")}</p>
            <Clock className="h-4 w-4 text-[#B7791F]" />
          </div>
          <p className="text-[20px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{money(data.totalCents)}</p>
          <p className="text-[10px] text-[#A09E98] mt-[5px]">{t("sessionsCount", { count: data.sessions.length })}</p>
        </div>
        {buckets.map((b) => (
          <div key={b.label} className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
            <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[8px]">{b.label}</p>
            <p className={`text-[18px] font-semibold tracking-[-0.03em] leading-none ${b.danger ? "text-[#B42318]" : b.warn ? "text-[#B7791F]" : "text-[#0F1A2E]"}`}>{money(b.value)}</p>
          </div>
        ))}
      </div>

      {/* Sessões em aberto */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
        <div className="px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">{t("listTitle")}</p>
        </div>
        {data.sessions.length === 0 ? (
          <p className="text-[12px] text-[#A09E98] px-[16px] py-[24px] text-center">{t("empty")}</p>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {data.sessions.map((s) => (
              <div key={s.appointment_id} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F1A2E] truncate">{s.patient_name}</p>
                  <p className="text-[10px] text-[#A09E98]">
                    {s.session_type_name ? `${s.session_type_name} · ` : ""}
                    {new Date(s.starts_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full shrink-0 ${s.daysOverdue > 90 ? "bg-red-50 text-red-500" : s.daysOverdue > 30 ? "bg-amber-50 text-amber-600" : "bg-[#F4F3EF] text-[#A09E98]"}`}>
                  {t("daysOverdue", { days: s.daysOverdue })}
                </span>
                <p className="text-[13px] font-medium text-[#0F1A2E] shrink-0">{money(s.price_cents)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
