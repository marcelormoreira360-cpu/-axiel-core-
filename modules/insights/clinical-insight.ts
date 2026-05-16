import type { AiInsightOutput, Appointment, IntakeResponse, Patient, SessionRecord } from "@/lib/types";

export const CLINICAL_INSIGHT_NOTICE = "AI-generated insights (not medical advice)";

export type ClinicalInsightSection = {
  title: string;
  body: string;
};

export type ClinicalInsight = {
  title: "Your Insight";
  notice: typeof CLINICAL_INSIGHT_NOTICE;
  generated_at: string;
  patient_overview: ClinicalInsightSection[];
  key_observations: string[];
  patterns: ClinicalInsightSection[];
  simple_next_steps: string[];
  closing_note: string;
};

function cleanText(value: string | null | undefined, fallback = "Not added yet.") {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not added yet";
  return new Date(value).toLocaleDateString([], { dateStyle: "medium" });
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export function buildPatientFriendlyClinicalInsight(input: {
  patient: Patient;
  intakeResponses: IntakeResponse[];
  appointments: Appointment[];
  sessionRecords: SessionRecord[];
  aiInsight?: AiInsightOutput | null;
}): ClinicalInsight {
  const { patient, intakeResponses, appointments, sessionRecords, aiInsight } = input;
  const intakeCount = intakeResponses.length;
  const sessionCount = appointments.length;
  const latestSession = appointments[0];

  const observationsFromSessions = sessionRecords.flatMap((record) => record.key_observations ?? []);
  const observationsFromAi = aiInsight?.structured_summary?.key_context ?? [];
  const keyObservations = unique([...observationsFromSessions, ...observationsFromAi]).slice(0, 8);

  const aiPatterns = aiInsight?.patterns_and_correlations?.map((pattern) => ({
    title: cleanText(pattern.title, "Observed pattern"),
    body: cleanText(pattern.insight, "There may be a pattern. More information may help."),
  })) ?? [];

  const fallbackPatterns: ClinicalInsightSection[] = [
    {
      title: "Information gathered so far",
      body: `Your clinic has saved ${intakeCount} intake answer${intakeCount === 1 ? "" : "s"} and ${sessionCount} session${sessionCount === 1 ? "" : "s"}. This helps your clinic see your story over time.`,
    },
    {
      title: "What your notes may show",
      body: "This insight puts your answers and session notes in one place. It helps your clinic see patterns. It is not a diagnosis or a plan.",
    },
  ];

  const reviewPoints = aiInsight?.practitioner_review_points?.length
    ? aiInsight.practitioner_review_points
    : [
        "Review the intake answers together.",
        "Confirm what matters most from recent sessions.",
        "Update this insight after more sessions.",
      ];

  return {
    title: "Your Insight",
    notice: CLINICAL_INSIGHT_NOTICE,
    generated_at: new Date().toISOString(),
    patient_overview: [
      { title: "Patient", body: patient.full_name },
      { title: "Status", body: patient.status },
      { title: "Email", body: cleanText(patient.email) },
      { title: "Phone", body: cleanText(patient.phone) },
      { title: "Birthday", body: formatDate(patient.date_of_birth) },
      { title: "Last Session", body: latestSession ? formatDate(latestSession.starts_at) : "No sessions yet" },
      { title: "Notes", body: cleanText(patient.notes, "No notes yet.") },
    ],
    key_observations: keyObservations.length ? keyObservations : ["No key notes have been saved yet."],
    patterns: aiPatterns.length ? aiPatterns : fallbackPatterns,
    simple_next_steps: reviewPoints.slice(0, 6),
    closing_note:
      "This insight puts information in simple words. It is not a diagnosis. It is not a session plan. Please talk with your clinic if you have questions.",
  };
}
