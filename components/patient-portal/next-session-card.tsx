"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { formatDateTime } from "./portal-ui";
import { PaySessionButton } from "./pay-session-button";

// ── Próxima sessão ────────────────────────────────────────────────────────────
export function NextSessionCard({
  nextSession,
  whatsappUrl,
  rawToken,
  brandColor,
}: {
  nextSession: PatientPortalData["upcomingAppointments"][number] | undefined;
  whatsappUrl: PatientPortalData["whatsappUrl"];
  rawToken: string;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();

  return nextSession ? (
    <div className="rounded-2xl p-5 text-white" style={{ backgroundColor: brandColor }}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50 mb-2">{t("nextSession")}</p>
      <p className="text-lg font-semibold">{formatDateTime(nextSession.starts_at, locale, t("at"))}</p>
      {nextSession.duration_minutes && (
        <p className="text-sm text-white/60 mt-1">{t("minutes", { count: nextSession.duration_minutes })}</p>
      )}
      {nextSession.payment_status === "pending" && (
        <div className="mt-4">
          <PaySessionButton
            appointmentId={nextSession.id}
            priceCents={nextSession.price_cents}
            rawToken={rawToken}
            brandColor="rgba(255,255,255,0.9)"
          />
        </div>
      )}
      {nextSession.payment_status === "paid" && (
        <p className="mt-3 text-xs font-medium text-white/70">{t("sessionPaid")}</p>
      )}
      {nextSession.payment_status === "covered" && (
        <p className="mt-3 text-xs font-medium text-white/70">{t("coveredByPackage")}</p>
      )}
      {nextSession.zoom_join_url && (
        <a
          href={nextSession.zoom_join_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center gap-2 w-full justify-center rounded-xl py-2.5 text-sm font-semibold transition"
          style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 10.5v3l4-3v6l-4-3v3a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h10a1 1 0 011 1v3.5z"/>
          </svg>
          {t("joinTelehealth")}
        </a>
      )}
      {whatsappUrl && (
        <Link
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-xs font-medium text-white/70 hover:text-white underline underline-offset-2 transition"
        >
          {t("requestReschedule")}
        </Link>
      )}
    </div>
  ) : (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40 mb-2">{t("nextSession")}</p>
      <p className="text-sm text-black/50">{t("noSession")}</p>
      {whatsappUrl && (
        <Link
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-medium text-[#0F6E56] hover:underline"
        >
          {t("bookViaWhatsapp")}
        </Link>
      )}
    </div>
  );
}
