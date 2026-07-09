"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { formatDate, Section } from "./portal-ui";
import { PaySessionButton } from "./pay-session-button";

// ── Session history card with expandable observations ────────────────────────
function SessionHistoryCard({
  session,
  sessionNumber,
  rawToken,
  brandColor,
}: {
  session: import("@/services/patient-portal-service").PatientPortalSessionItem;
  sessionNumber: number;
  rawToken: string;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const hasObs = session.observations.length > 0;

  return (
    <div className="border-b border-black/[.05] last:border-0">
      <div className="flex items-start justify-between py-2.5 gap-2">
        {/* Left: session number + meta */}
        <button
          onClick={() => hasObs && setExpanded((v) => !v)}
          className={`flex-1 flex items-start gap-2 text-left min-w-0 ${hasObs ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[#0F1A2E]">{t("sessionNum", { number: sessionNumber })}</span>
              <span className="text-xs text-black/40">{formatDate(session.starts_at, locale)}</span>
              {session.session_type_name && (
                <span className="text-[10px] bg-black/[.05] text-black/45 rounded-full px-2 py-0.5">
                  {session.session_type_name}
                </span>
              )}
              {session.duration_minutes > 0 && (
                <span className="text-[10px] text-black/30">{session.duration_minutes} {t("minUnit")}</span>
              )}
            </div>
          </div>
          {hasObs && (
            <span className="shrink-0 text-black/25 mt-0.5">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
          )}
        </button>

        {/* Right: payment status */}
        <div className="flex items-center gap-2 shrink-0">
          {session.payment_status === "paid" && (
            <span className="text-xs font-medium text-[#0F6E56]">{t("paid")}</span>
          )}
          {session.payment_status === "covered" && (
            <span className="text-xs text-black/40">{t("packageLabel")}</span>
          )}
          {session.payment_status === "pending" && (
            <PaySessionButton
              appointmentId={session.id}
              priceCents={session.price_cents}
              rawToken={rawToken}
              brandColor={brandColor}
            />
          )}
          {session.has_feedback && (
            <span className="text-[10px] text-black/30">⭐</span>
          )}
        </div>
      </div>

      {/* Expandable observations */}
      {expanded && hasObs && (
        <div className="mb-3 ml-1 bg-[#F8F9FA] rounded-xl px-3 py-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/35 mb-1">{t("obsTitle")}</p>
          {session.observations.map((obs, i) => (
            <p key={i} className="text-xs text-black/60 leading-relaxed">
              • {obs}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Histórico de sessões ──────────────────────────────────────────────────────
export function SessionsHistorySection({
  sessions,
  rawToken,
  brandColor,
}: {
  sessions: PatientPortalData["sessions"];
  rawToken: string;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");

  // Session history expand state
  const [showAllSessions, setShowAllSessions] = useState(false);
  const SESSION_PREVIEW = 5;

  return (
    <Section title={t("historyTitle")}>
      <div className="space-y-1">
        {(showAllSessions ? sessions : sessions.slice(0, SESSION_PREVIEW)).map((session, index) => (
          <SessionHistoryCard
            key={session.id ?? index}
            session={session}
            sessionNumber={sessions.length - index}
            rawToken={rawToken}
            brandColor={brandColor}
          />
        ))}
      </div>
      {sessions.length > SESSION_PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAllSessions((v) => !v)}
          className="mt-1 text-xs text-black/40 hover:text-black/70 transition underline underline-offset-2"
        >
          {showAllSessions
            ? t("viewLess")
            : t("viewMoreSessions", { count: sessions.length - SESSION_PREVIEW })}
        </button>
      )}
    </Section>
  );
}
