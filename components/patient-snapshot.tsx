"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { ViewDetails } from "@/components/view-details";
import type { PatientJourneySnapshot } from "@/modules/patient-journey/snapshot-builder";

export type PatientSnapshotData = PatientJourneySnapshot;

function snapshotStatusTone(status: PatientJourneySnapshot["latest_insight_status"]) {
  if (status === "Final") return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-100 dark:ring-emerald-500/20";
  if (status === "In Review") return "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-100 dark:ring-amber-500/20";
  return "bg-slate-100 dark:bg-white/[.08] text-slate-500 ring-slate-200 dark:ring-white/10";
}

// Códigos de status (lógica) → chave de tradução (exibição). O valor cru continua
// sendo o código canônico usado por session-drawer/next-step-rules.
const STATUS_KEY: Record<PatientJourneySnapshot["latest_insight_status"], string> = {
  Final: "status.final",
  "In Review": "status.inReview",
  "Not ready": "status.notReady",
};

export function PatientSnapshot({
  snapshot,
  patientId,
  compact = false,
  showActions = true,
}: {
  snapshot: PatientSnapshotData;
  patientId?: string;
  compact?: boolean;
  showActions?: boolean;
}) {
  const t = useTranslations("patientSnapshot");

  return (
    <section className="rounded-2xl border border-axiel-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-axiel-text-primary">{t("title")}</p>
          <p className="mt-1 text-xs text-axiel-text-secondary">{t("subtitle")}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${snapshotStatusTone(snapshot.latest_insight_status)}`}>
          {t(STATUS_KEY[snapshot.latest_insight_status])}
        </span>
      </div>

      <div className="mt-5 grid gap-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">{t("latestInsight")}</p>
          <p className="mt-1 line-clamp-2 leading-6 text-axiel-text-primary">{snapshot.latest_insight_summary}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">{t("lastSession")}</p>
          <p className="mt-1 line-clamp-2 leading-6 text-axiel-text-primary">
            {snapshot.last_session_date ? `${snapshot.last_session_date} · ${snapshot.last_session_summary}` : snapshot.last_session_summary}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">{t("keyNotes")}</p>
          <ul className="mt-2 space-y-1 text-axiel-text-primary">
            {snapshot.key_notes.slice(0, 3).map((note, index) => (
              <li key={`${note}-${index}`} className="line-clamp-1">• {note}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">{t("nextStep")}</p>
          <p className="mt-1 line-clamp-2 leading-6 text-axiel-text-primary">{snapshot.next_step}</p>
        </div>

        {!compact ? (
          <ViewDetails label={t("viewDetails")}>
            <div className="grid gap-3 rounded-2xl bg-axiel-background p-4 text-sm text-axiel-text-secondary">
              <p><span className="font-medium text-axiel-text-primary">{t("attention")}</span> {snapshot.attention_needed}</p>
              <p><span className="font-medium text-axiel-text-primary">{t("followUp")}</span> {snapshot.pending_follow_ups_count > 0 ? t("followUpPending", { count: snapshot.pending_follow_ups_count }) : t("followUpClear")}</p>
              <p><span className="font-medium text-axiel-text-primary">{t("patientStatus")}</span> {snapshot.patient_status}</p>
            </div>
          </ViewDetails>
        ) : null}

        {showActions && patientId ? (
          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            <Link href={`/patients/${patientId}`}>
              <ButtonPrimary className="w-full">{t("openPatient")}</ButtonPrimary>
            </Link>
            <Link href={`/patients/${patientId}/notes`}>
              <ButtonSecondary className="w-full">{t("addNote")}</ButtonSecondary>
            </Link>
            <Link href={`/follow-ups?patient=${patientId}`}>
              <ButtonSecondary className="w-full">{t("createFollowUp")}</ButtonSecondary>
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
