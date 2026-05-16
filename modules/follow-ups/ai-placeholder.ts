import type { Appointment, FollowUp, Patient } from "@/lib/types";

export const FOLLOW_UP_AI_LABEL = "AI placeholder: next follow-up timing";

export function getSuggestedFollowUpTimingPlaceholder(input: {
  patient: Patient;
  appointments?: Appointment[];
  followUps?: FollowUp[];
}) {
  const lastAppointment = input.appointments?.[0];
  const pendingFollowUp = input.followUps?.find((item) => item.status === "pending");

  if (pendingFollowUp) {
    return "A follow-up is already pending. Review it before creating another reminder.";
  }

  if (lastAppointment) {
    return "Next Step timing placeholder: review this patient within 7–14 days after the last session.";
  }

  return "Next Step timing placeholder: schedule the first follow-up after the initial session is created.";
}

export function getFollowUpReviewPrompts() {
  return [
    "Confirm whether the patient needs a next session reminder.",
    "Choose email or SMS placeholder if a message should be drafted later.",
    "Review timing manually before sending anything.",
  ];
}
