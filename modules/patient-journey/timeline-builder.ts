import type { AiInsight, Appointment, IntakeResponse, SessionRecord } from "@/lib/types";

export type PatientJourneyTimelineItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  date: string;
};

export function buildPatientJourneyTimeline(input: {
  appointments?: Appointment[];
  sessionRecords?: SessionRecord[];
  intakeResponses?: IntakeResponse[];
  aiInsights?: AiInsight[];
}): PatientJourneyTimelineItem[] {
  const items: PatientJourneyTimelineItem[] = [
    ...(input.appointments ?? []).map((item) => ({
      id: `session-${item.id}`,
      label: "Session",
      title: "Session completed",
      description: item.notes ?? `${item.duration_minutes} minute Session.`,
      date: item.starts_at,
    })),
    ...(input.sessionRecords ?? []).map((item) => ({
      id: `note-${item.id}`,
      label: "Note",
      title: "Session note",
      description: item.key_observations?.slice(0, 2).join(" · ") || item.notes || "Note saved.",
      date: item.updated_at,
    })),
    ...(input.intakeResponses ?? []).map((item) => ({
      id: `form-${item.id}`,
      label: "Form",
      title: item.intake_questions?.label ?? "Form answer",
      description: typeof item.answer === "string" ? item.answer : JSON.stringify(item.answer),
      date: item.created_at,
    })),
    ...(input.aiInsights ?? []).map((item) => ({
      id: `insight-${item.id}`,
      label: "Insight",
      title: item.review_status === "final" ? "Final Insight" : "Insight in review",
      description: item.output?.structured_summary?.overview ?? "Insight created.",
      date: item.created_at,
    })),
  ];

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
}
