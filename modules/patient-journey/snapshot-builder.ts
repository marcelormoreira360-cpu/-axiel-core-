import type { AiInsight, Appointment, FollowUp, IntakeResponse, Patient, SessionRecord } from "@/lib/types";

// Tradutor injetado pela camada de render (next-intl: getTranslations no server,
// useTranslations no client). Mantém este módulo puro/agnóstico de idioma.
export type SnapshotTranslator = (key: string, values?: Record<string, string | number>) => string;

// Fallback identidade: se nenhum tradutor for passado, devolve a própria chave
// (evita quebrar; a camada de render sempre deve passar o tradutor real).
const identity: SnapshotTranslator = (key) => key;

export type PatientJourneySnapshot = {
  patient_name: string;
  patient_status: string;
  latest_insight_title: string;
  latest_insight_summary: string;
  latest_insight_status: "In Review" | "Final" | "Not ready";
  last_session_date: string | null;
  last_session_summary: string;
  key_notes: string[];
  next_step: string;
  attention_needed: string;
  pending_reviews_count: number;
  follow_up_status: string;
  pending_follow_ups_count: number;
};

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const clean = value.trim();
  return clean.length ? clean : fallback;
}

function formatSessionDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function insightSummary(t: SnapshotTranslator, insight?: AiInsight | null) {
  const output = insight?.review_status === "final" ? insight.final_output ?? insight.output : insight?.output;
  return cleanText(output?.structured_summary?.overview, t("insight.noneSummary"));
}

function insightTitle(t: SnapshotTranslator, insight?: AiInsight | null) {
  if (!insight) return t("insight.noneTitle");
  return insight.review_status === "final" ? t("insight.latestTitle") : t("insight.reviewTitle");
}

function insightStatus(insight?: AiInsight | null): PatientJourneySnapshot["latest_insight_status"] {
  if (!insight) return "Not ready";
  return insight.review_status === "final" ? "Final" : "In Review";
}

function noteFromResponse(response?: IntakeResponse | null) {
  if (!response?.intake_questions?.label) return null;
  const raw = response.answer;
  const answer = typeof raw === "string" ? raw : JSON.stringify(raw);
  return `${response.intake_questions.label}: ${answer}`;
}

export function buildPatientJourneySnapshot(input: {
  patient: Pick<Patient, "full_name" | "status" | "notes">;
  appointments?: Appointment[];
  sessionRecords?: SessionRecord[];
  intakeResponses?: IntakeResponse[];
  aiInsights?: AiInsight[];
  followUps?: FollowUp[];
}, t: SnapshotTranslator = identity): PatientJourneySnapshot {
  const appointments = input.appointments ?? [];
  const sessionRecords = input.sessionRecords ?? [];
  const intakeResponses = input.intakeResponses ?? [];
  const aiInsights = input.aiInsights ?? [];
  const followUps = input.followUps ?? [];

  const latestInsight = aiInsights.find((item) => item.review_status === "final") ?? aiInsights[0] ?? null;
  const lastSession = appointments[0] ?? null;
  const latestRecord = sessionRecords[0] ?? null;
  const pendingReviews = aiInsights.filter((item) => item.review_status !== "final").length;
  const pendingFollowUps = followUps.filter((item) => item.status === "pending").length;

  const keyNotes = [
    latestRecord?.key_observations?.[0],
    latestRecord?.key_observations?.[1],
    latestRecord?.notes,
    input.patient.notes,
    noteFromResponse(intakeResponses[0]),
  ]
    .filter(Boolean)
    .map((item) => cleanText(item, ""))
    .filter(Boolean)
    .slice(0, 3);

  const attentionNeeded =
    pendingReviews > 0
      ? t("attentionInsightReviews", { count: pendingReviews })
      : pendingFollowUps > 0
        ? t("attentionOpenFollowUps", { count: pendingFollowUps })
        : t("attentionNone");

  const nextStep =
    latestInsight?.review_status === "final"
      ? cleanText((latestInsight.final_output ?? latestInsight.output)?.structured_summary?.current_status, t("nextStepReviewNext"))
      : pendingReviews > 0
        ? t("nextStepReviewInsight")
        : t("nextStepConfirmFocus");

  return {
    patient_name: input.patient.full_name,
    patient_status: input.patient.status,
    latest_insight_title: insightTitle(t, latestInsight),
    latest_insight_summary: insightSummary(t, latestInsight),
    latest_insight_status: insightStatus(latestInsight),
    last_session_date: formatSessionDate(lastSession?.starts_at),
    last_session_summary: lastSession
      ? cleanText(lastSession.notes, t("lastSessionCompleted", { minutes: lastSession.duration_minutes ?? 0 }))
      : t("lastSessionNone"),
    key_notes: keyNotes.length ? keyNotes : [t("keyNotesReviewIntake")],
    next_step: nextStep,
    attention_needed: attentionNeeded,
    pending_reviews_count: pendingReviews,
    follow_up_status: pendingFollowUps ? `${pendingFollowUps} pending` : "Clear",
    pending_follow_ups_count: pendingFollowUps,
  };
}

// Adapta um Appointment (+ texto de insight inline opcional) para o snapshot.
// Vive aqui (camada de módulo, pura) para poder rodar tanto em Server quanto
// em Client Components; a tradução é injetada via `t`.
export function buildPatientSnapshot(
  input: {
    appointment: Appointment;
    previousSessions: Appointment[];
    latestInsightText?: string | null;
  },
  t: SnapshotTranslator = identity,
): PatientJourneySnapshot {
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
            current_status: t("nextStepConfirmFocus"),
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
    full_name: input.appointment.patients?.full_name ?? t("patientFallback"),
    status: input.appointment.patients?.status ?? "active",
    notes: input.appointment.notes,
  };

  return buildPatientJourneySnapshot(
    {
      patient,
      appointments: [input.appointment, ...input.previousSessions],
      aiInsights: fallbackInsight ? [fallbackInsight] : [],
    },
    t,
  );
}

export function buildPatientPortalSnapshot(snapshot: PatientJourneySnapshot) {
  return {
    progressMessage:
      snapshot.latest_insight_status === "Final"
        ? "Your clinic has a recent update ready."
        : "Your clinic is reviewing your information.",
    latestNextStep: snapshot.next_step,
    simpleStatus: snapshot.follow_up_status === "Clear" ? "You are on track." : "Your clinic will follow up with you.",
  };
}
