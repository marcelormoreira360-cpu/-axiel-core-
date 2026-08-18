import { getTranslations, getLocale } from "next-intl/server";

// Classes por status (estilo). O RÓTULO vem do i18n (billing.statusCard.status.*).
const STATUS_CLASS: Record<string, string> = {
  active:             "bg-[#E1F5EE] text-[#0F6E56]",
  trialing:           "bg-blue-50 text-blue-600",
  past_due:           "bg-amber-50 text-amber-600",
  canceled:           "bg-red-50 text-red-500",
  incomplete:         "bg-[#F4F3EF] text-[#6B6A66]",
  incomplete_expired: "bg-red-50 text-red-500",
  unpaid:             "bg-red-50 text-red-500",
};

type Props = {
  planName: string | null;
  status: string | null;
  trialEndsAt?: string | null;
  renewsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  hasCustomer?: boolean;
};

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

export async function SubscriptionStatusCard({ planName, status, trialEndsAt, renewsAt, cancelAtPeriodEnd, hasCustomer }: Props) {
  const t = await getTranslations("billing.statusCard");
  const locale = await getLocale();

  const statusClass = STATUS_CLASS[status ?? ""] ?? "bg-[#F4F3EF] text-[#6B6A66]";
  const statusLabel = status
    ? status in STATUS_CLASS
      ? t(`status.${status}`)
      : status
    : t("noPlan");

  return (
    <div className="bg-[#0F1A2E] rounded-[14px] px-[18px] py-[16px] flex flex-col gap-[12px] md:flex-row md:items-center md:justify-between">
      {/* Info */}
      <div className="flex items-center gap-[14px]">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-[8px] mb-[3px]">
            <p className="text-[15px] font-semibold text-white">{planName ?? t("noPlan")}</p>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-[7px] py-[2px] rounded-full ${statusClass}`}>
              {statusLabel}
            </span>
            {cancelAtPeriodEnd && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-[7px] py-[2px] rounded-full bg-amber-50 text-amber-600">
                {t("cancelsAtPeriodEnd")}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/50">
            {trialEndsAt
              ? t("trialEndsOn", { date: formatDate(trialEndsAt, locale) })
              : renewsAt
              ? t("renewsOn", { date: formatDate(renewsAt, locale) })
              : t("noActiveSubscription")}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-[8px] flex-wrap">
        {hasCustomer && (
          <form action="/api/stripe/portal" method="POST">
            <button
              type="submit"
              className="text-[12px] font-medium text-white border border-white/20 hover:bg-white/10 rounded-[8px] px-[14px] py-[8px] transition"
            >
              {t("manage")}
            </button>
          </form>
        )}
        {!status && (
          <a
            href="#planos"
            className="text-[12px] font-medium text-[#0F1A2E] bg-white hover:bg-[#F4F3EF] rounded-[8px] px-[14px] py-[8px] transition"
          >
            {t("viewPlans")}
          </a>
        )}
      </div>
    </div>
  );
}
