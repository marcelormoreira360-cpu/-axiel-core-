import Link from "next/link";
import type { AiInsight, Appointment, FollowUp, IntakeResponse, Patient, SessionRecord } from "@/lib/types";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { ViewDetails } from "@/components/view-details";
import {
  buildPatientJourneySnapshot,
  type PatientJourneySnapshot,
} from "@/modules/patient-journey/snapshot-builder";

export type PatientSnapshotData = PatientJourneySnapshot;

export function buildPatientSnapshot(input: {
  appointment: Appointment;
  previousSessions: Appointment[];
  latestInsightText?: string | null;
}): PatientSnapshotData {
  const fallbackInsight: AiInsight | null = input.latestInsightText
    ? {
        id: "inline-insight",
        clinic_id: input.appointment.clinic_id,
        patient_id: input.appointment.patient_id,
        created_by: null,
        input_snapshot: {},
        output: {
          label: "AI-generated insights (not medical advice)",
          structured_summary: {
            overview: input.latestInsightText,
            key_context: [],
            current_status: "Confirm today’s focus and keep the follow-up simple.",
          },
          patterns_and_correlations: [],
          practitioner_review_points: [],
          data_limitations: [],
          safety_note: "AI-generated insights are not medical advice.",
        },
        final_output: null,
        status: "completed",
        review_status: "pending_review",
        approved_by: null,
        approved_at: null,
        reviewer_notes: null,
        changes_made: null,
        last_reviewed_by: null,
        last_reviewed_at: null,
        created_at: input.appointment.created_at,
      }
    : null;

  const patient: Pick<Patient, "full_name" | "status" | "notes"> = {
    full_name: input.appointment.patients?.full_name ?? "Patient",
    status: input.appointment.patients?.status ?? "active",
    notes: input.appointment.notes,
  };

  return buildPatientJourneySnapshot({
    patient,
    appointments: [input.appointment, ...input.previousSessions],
    aiInsights: fallbackInsight ? [fallbackInsight] : [],
  });
}

function snapshotStatusTone(status: PatientJourneySnapshot["latest_insight_status"]) {
  if (status === "Final") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "In Review") return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-slate-100 text-slate-500 ring-slate-200";
}

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
  return (
    <section className="rounded-2xl border border-axiel-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-axiel-text-primary">Patient Snapshot</p>
          <p className="mt-1 text-xs text-axiel-text-secondary">Context for the next decision.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${snapshotStatusTone(snapshot.latest_insight_status)}`}>
          {snapshot.latest_insight_status}
        </span>
      </div>

      <div className="mt-5 grid gap-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">Latest Insight</p>
          <p className="mt-1 line-clamp-2 leading-6 text-axiel-text-primary">{snapshot.latest_insight_summary}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">Last Session</p>
          <p className="mt-1 line-clamp-2 leading-6 text-axiel-text-primary">
            {snapshot.last_session_date ? `${snapshot.last_session_date} · ${snapshot.last_session_summary}` : snapshot.last_session_summary}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">Key Notes</p>
          <ul className="mt-2 space-y-1 text-axiel-text-primary">
            {snapshot.key_notes.slice(0, 3).map((note, index) => (
              <li key={`${note}-${index}`} className="line-clamp-1">• {note}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-axiel-text-secondary">Next Step</p>
          <p className="mt-1 line-clamp-2 leading-6 text-axiel-text-primary">{snapshot.next_step}</p>
        </div>

        {!compact ? (
          <ViewDetails label="View details">
            <div className="grid gap-3 rounded-2xl bg-axiel-background p-4 text-sm text-axiel-text-secondary">
              <p><span className="font-medium text-axiel-text-primary">Attention:</span> {snapshot.attention_needed}</p>
              <p><span className="font-medium text-axiel-text-primary">Follow-up:</span> {snapshot.follow_up_status}</p>
              <p><span className="font-medium text-axiel-text-primary">Patient status:</span> {snapshot.patient_status}</p>
            </div>
          </ViewDetails>
        ) : null}

        {showActions && patientId ? (
          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            <Link href={`/patients/${patientId}`}>
              <ButtonPrimary className="w-full">Open patient</ButtonPrimary>
            </Link>
            <Link href={`/patients/${patientId}/notes`}>
              <ButtonSecondary className="w-full">Add note</ButtonSecondary>
            </Link>
            <Link href={`/follow-ups?patient=${patientId}`}>
              <ButtonSecondary className="w-full">Create follow-up</ButtonSecondary>
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
