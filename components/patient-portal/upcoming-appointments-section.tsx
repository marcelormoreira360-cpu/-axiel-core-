"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { cancelPortalAppointmentAction } from "@/app/p/[token]/actions";
import { formatDateTime, Section } from "./portal-ui";
import { PaySessionButton } from "./pay-session-button";

function CancelAppointmentButton({
  appointmentId,
  rawToken,
  brandColor,
}: {
  appointmentId: string;
  rawToken: string;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");
  const [confirming, setConfirming] = useState(false);
  const [loading, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <span className="shrink-0 text-xs text-red-500">{t("apptCanceled")}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 text-[10px] text-black/30 hover:text-red-500 transition px-2 py-1 rounded border border-black/[.06] hover:border-red-200"
      >
        {t("cancel")}
      </button>
    );
  }

  return (
    <div className="shrink-0 flex items-center gap-1.5">
      <span className="text-[10px] text-black/50">{t("confirmQ")}</span>
      <button
        type="button"
        onClick={() => {
          startTransition(async () => {
            const result = await cancelPortalAppointmentAction(rawToken, appointmentId);
            if (result.ok) {
              setDone(true);
            } else {
              setError(result.error);
              setConfirming(false);
            }
          });
        }}
        disabled={loading}
        className="text-[10px] font-medium text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1 rounded transition disabled:opacity-50"
      >
        {loading ? "…" : t("yes")}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[10px] text-black/40 border border-black/[.08] hover:bg-black/[.03] px-2 py-1 rounded transition"
      >
        {t("no")}
      </button>
      {error && <span className="text-[10px] text-red-500 ml-1">{error}</span>}
    </div>
  );
}

// ── Próximas sessões (list) ───────────────────────────────────────────────────
export function UpcomingAppointmentsSection({
  appointments,
  rawToken,
  brandColor,
}: {
  appointments: PatientPortalData["upcomingAppointments"];
  rawToken: string;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();

  return (
    <Section title={t("upcomingTitle")}>
      <div className="space-y-2">
        {appointments.map((appt, index) => (
          <div
            key={appt.id ?? index}
            className="flex items-start justify-between py-2 border-b border-black/[.05] last:border-0 gap-2"
          >
            <div>
              <span className="text-sm text-[#0F1A2E]">{formatDateTime(appt.starts_at, locale, t("at"))}</span>
              {appt.duration_minutes && (
                <span className="ml-2 text-xs text-black/40">{appt.duration_minutes} {t("minUnit")}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {appt.zoom_join_url && (
                <a
                  href={appt.zoom_join_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] font-semibold text-white bg-[#0078D4] hover:bg-[#006BBE] px-2.5 py-1 rounded-lg transition"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15 10.5v3l4-3v6l-4-3v3a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h10a1 1 0 011 1v3.5z"/>
                  </svg>
                  Zoom
                </a>
              )}
              {appt.payment_status === "pending" && (
                <PaySessionButton
                  appointmentId={appt.id}
                  priceCents={appt.price_cents}
                  rawToken={rawToken}
                  brandColor={brandColor}
                />
              )}
              {appt.payment_status === "paid" && (
                <span className="shrink-0 text-xs font-medium text-[#0F6E56]">{t("paid")}</span>
              )}
              {appt.payment_status === "covered" && (
                <span className="shrink-0 text-xs text-black/40">{t("packageLabel")}</span>
              )}
              <CancelAppointmentButton
                appointmentId={appt.id}
                rawToken={rawToken}
                brandColor={brandColor}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
