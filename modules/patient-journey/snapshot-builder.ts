import type { AiInsight, Appointment, FollowUp, IntakeResponse, Patient, SessionRecord } from "@/lib/types";

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

function insightSummary(insight?: AiInsight | null) {
  const output = insight?.review_status === "final" ? insight.final_output ?? insight.output : insight?.output;
  return cleanText(output?.structured_summary?.overview, "No Insight is ready yet.");
}

function insightTitle(insight?: AiInsight | null) {
  if (!insight) return "No Insight yet";
  return insight.review_status === "final" ? "Latest Insight" : "Insight in review";
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
}): PatientJourneySnapshot {
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
      ? `${pendingReviews} Insight ${pendingReviews === 1 ? "review" : "reviews"} waiting.`
      : pendingFollowUps > 0
        ? `${pendingFollowUps} follow-up ${pendingFollowUps === 1 ? "is" : "are"} open.`
        : "No urgent attention needed.";

  const nextStep =
    latestInsight?.review_status === "final"
      ? cleanText((latestInsight.final_output ?? latestInsight.output)?.structured_summary?.current_status, "Review the next patient step.")
      : pendingReviews > 0
        ? "Review the Insight before sharing any next step."
        : "Confirm today’s focus and keep the follow-up simple.";

  return {
    patient_name: input.patient.full_name,
    patient_status: input.patient.status,
    latest_insight_title: insightTitle(latestInsight),
    latest_insight_summary: insightSummary(latestInsight),
    latest_insight_status: insightStatus(latestInsight),
    last_session_date: formatSessionDate(lastSession?.starts_at),
    last_session_summary: lastSession
      ? cleanText(lastSession.notes, `${lastSession.duration_minutes} minute Session completed.`)
      : "No previous Session recorded.",
    key_notes: keyNotes.length ? keyNotes : ["Review intake before this Session."],
    next_step: nextStep,
    attention_needed: attentionNeeded,
    pending_reviews_count: pendingReviews,
    follow_up_status: pendingFollowUps ? `${pendingFollowUps} pending` : "Clear",
  };
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
