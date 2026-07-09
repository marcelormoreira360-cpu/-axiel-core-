"use client";

import { useTranslations, useLocale } from "next-intl";
import { type PatientPortalData } from "@/services/patient-portal-service";

export function SubscriptionCard({
  sub,
  brandColor,
}: {
  sub: NonNullable<PatientPortalData["activeSubscription"]>;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();
  const fmt = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: sub.currency }).format(cents / 100);

  const renewsAt = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(locale, { day: "numeric", month: "short" })
    : null;

  const statusConfig: Record<string, { labelKey: string; color: string }> = {
    active:    { labelKey: "statusActive",     color: "#0F6E56" },
    trialing:  { labelKey: "statusTrialing",   color: "#3B82F6" },
    past_due:  { labelKey: "statusPastDue",    color: "#F59E0B" },
    paused:    { labelKey: "statusPaused",     color: "#6B7280" },
    canceled:  { labelKey: "statusCanceled",   color: "#EF4444" },
    incomplete: { labelKey: "statusIncomplete", color: "#F59E0B" },
  };
  const cfg = statusConfig[sub.status];
  const st = { label: cfg ? t(cfg.labelKey) : sub.status, color: cfg?.color ?? "#6B7280" };

  const sessionsLeft = sub.sessionsPerCycle > 0 ? sub.sessionsPerCycle - sub.sessionsUsedThisCycle : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F1A2E]">{sub.planName}</p>
          <p className="text-xs text-black/45 mt-0.5">
            {fmt(sub.amountCents)} / {sub.billingInterval === "yearly" ? t("perYear") : t("perMonth")}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-[.1em] px-2 py-1 rounded-full"
          style={{ backgroundColor: `${st.color}15`, color: st.color }}
        >
          {st.label}
        </span>
      </div>

      {sessionsLeft !== null && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs text-black/50">{t("sessionsThisCycle")}</p>
            <p className="text-xs font-medium text-[#0F1A2E]">
              {sub.sessionsUsedThisCycle} / {sub.sessionsPerCycle}
            </p>
          </div>
          <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.round((sub.sessionsUsedThisCycle / sub.sessionsPerCycle) * 100))}%`,
                backgroundColor: brandColor,
              }}
            />
          </div>
          <p className="text-xs text-black/35 mt-1">
            {t("sessionsLeftCycle", { count: sessionsLeft })}
          </p>
        </div>
      )}

      {renewsAt && !sub.cancelAtPeriodEnd && sub.status !== "canceled" && (
        <p className="text-xs text-black/35 mt-2">
          {sub.status === "past_due" ? t("renewPendingDate", { date: renewsAt }) : t("renewDate", { date: renewsAt })}
        </p>
      )}
      {sub.cancelAtPeriodEnd && renewsAt && (
        <p className="text-xs text-amber-500 mt-2">{t("cancelsOn", { date: renewsAt })}</p>
      )}
      {sub.status === "past_due" && (
        <p className="text-xs text-amber-600 mt-2 font-medium">
          {t("pastDueWarning")}
        </p>
      )}
    </div>
  );
}
