"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus } from "lucide-react";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { PortalBookingModal } from "./portal-booking-modal";

// ── Agendar nova consulta ─────────────────────────────────────────────────────
export function BookingCta({
  sessionTypes,
  clinicSlug,
  rawToken,
  brandColor,
  bookingUrl,
}: {
  sessionTypes: PatientPortalData["sessionTypes"];
  clinicSlug: PatientPortalData["clinic"]["slug"];
  rawToken: string;
  brandColor: string;
  bookingUrl: string | null;
}) {
  const t = useTranslations("portal.dashboard");

  // Self-booking modal state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  return sessionTypes.length > 0 ? (
    <>
      {bookingConfirmed && (
        <div className="rounded-2xl bg-[#F0FAF5] border border-[#0F6E56]/20 p-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56]">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F1A2E]">{t("bookingDoneTitle")}</p>
            <p className="text-xs text-black/50 mt-0.5">{t("bookingDoneDesc")}</p>
          </div>
        </div>
      )}
      <button
        onClick={() => { setBookingOpen(true); setBookingConfirmed(false); }}
        className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 py-3.5 text-sm font-semibold transition hover:opacity-80"
        style={{ borderColor: brandColor, color: brandColor }}
      >
        <CalendarPlus className="h-4 w-4" />
        {t("bookNew")}
      </button>
      {bookingOpen && (
        <PortalBookingModal
          sessionTypes={sessionTypes}
          clinicSlug={clinicSlug}
          rawToken={rawToken}
          brandColor={brandColor}
          onClose={() => setBookingOpen(false)}
          onSuccess={() => {
            setBookingOpen(false);
            setBookingConfirmed(true);
          }}
        />
      )}
    </>
  ) : bookingUrl ? (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 py-3.5 text-sm font-semibold transition"
      style={{ borderColor: brandColor, color: brandColor }}
    >
      <CalendarPlus className="h-4 w-4" />
      {t("bookNew")}
    </a>
  ) : null;
}
