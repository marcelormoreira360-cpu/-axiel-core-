import type { Appointment, FollowUp, Lead, Patient } from "@/lib/types";

export type PendingAiReviewActionInput = {
  id: string;
  patient_id: string;
  patient_name: string;
  review_status: "pending_review" | "needs_changes";
  created_at: string;
};

export type ActionSuggestionDraft = {
  clinic_id: string;
  action_key: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "patient" | "lead" | "schedule" | "follow_up" | "system";
  entity_type: "patient" | "lead" | "appointment" | "follow_up" | "clinic" | null;
  entity_id: string | null;
  suggested_url: string | null;
  reason: string;
};

function daysBetween(date: string | null | undefined, now = new Date()) {
  if (!date) return null;
  const value = new Date(date).getTime();
  if (Number.isNaN(value)) return null;
  return Math.floor((now.getTime() - value) / (1000 * 60 * 60 * 24));
}

function latestAppointmentForPatient(patientId: string, appointments: Appointment[]) {
  return appointments
    .filter((appointment) => appointment.patient_id === patientId)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];
}

export function buildActionSuggestions(input: {
  clinicId: string;
  patients: Patient[];
  leads: Lead[];
  appointments: Appointment[];
  followUps: FollowUp[];
  aiReviews?: PendingAiReviewActionInput[];
}): ActionSuggestionDraft[] {
  const now = new Date();
  const drafts: ActionSuggestionDraft[] = [];

  (input.aiReviews ?? [])
    .slice(0, 8)
    .forEach((review) => {
      drafts.push({
        clinic_id: input.clinicId,
        action_key: `ai_review:${review.id}`,
        title: `Review AI insight for ${review.patient_name}`,
        description: review.review_status === "needs_changes" ? "Needs adjustment. Review the updated insight." : "An insight is ready for review.",
        priority: review.review_status === "needs_changes" ? "high" : "medium",
        category: "patient",
        entity_type: "patient",
        entity_id: review.patient_id,
        suggested_url: `/patients/${review.patient_id}/insights`,
        reason: "AI insights should be reviewed before becoming final.",
      });
    });

  input.followUps
    .filter((followUp) => followUp.status === "pending")
    .slice(0, 8)
    .forEach((followUp) => {
      const daysUntilDue = Math.ceil((new Date(followUp.due_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 7) {
        drafts.push({
          clinic_id: input.clinicId,
          action_key: `follow_up:${followUp.id}`,
          title: `Follow up with ${followUp.patients?.full_name ?? "this patient"}`,
          description: followUp.title,
          priority: daysUntilDue <= 0 ? "high" : "medium",
          category: "follow_up",
          entity_type: "follow_up",
          entity_id: followUp.id,
          suggested_url: `/follow-ups`,
          reason: daysUntilDue <= 0 ? "This follow-up is due now." : "This follow-up is coming up soon.",
        });
      }
    });

  input.leads
    .filter((lead) => lead.stage === "new_lead")
    .slice(0, 8)
    .forEach((lead) => {
      drafts.push({
        clinic_id: input.clinicId,
        action_key: `new_lead:${lead.id}`,
        title: "New lead ready to schedule",
        description: `${lead.full_name}${lead.main_complaint ? ` — ${lead.main_complaint}` : ""}. Give them one clear next step.`,
        priority: "medium",
        category: "lead",
        entity_type: "lead",
        entity_id: lead.id,
        suggested_url: `/leads/${lead.id}`,
        reason: "New leads should be contacted quickly while interest is fresh.",
      });
    });

  input.leads
    .filter((lead) => lead.stage === "scheduled" || lead.stage === "contacted")
    .slice(0, 8)
    .forEach((lead) => {
      drafts.push({
        clinic_id: input.clinicId,
        action_key: `lead_ready:${lead.id}:${lead.stage}`,
        title: lead.stage === "scheduled" ? "This lead is ready to convert" : "This lead is ready to schedule",
        description: `${lead.full_name} is already ${lead.stage.replaceAll("_", " ")}. Give them one clear next step.`,
        priority: lead.stage === "scheduled" ? "high" : "medium",
        category: "lead",
        entity_type: "lead",
        entity_id: lead.id,
        suggested_url: `/leads/${lead.id}`,
        reason: "The lead is already warm in the pipeline.",
      });
    });

  input.patients
    .filter((patient) => patient.status === "active")
    .slice(0, 20)
    .forEach((patient) => {
      const latestAppointment = latestAppointmentForPatient(patient.id, input.appointments);
      const daysSinceLastSession = daysBetween(latestAppointment?.starts_at, now);

      if (daysSinceLastSession !== null && daysSinceLastSession >= 30) {
        drafts.push({
          clinic_id: input.clinicId,
          action_key: `patient_no_return_30:${patient.id}`,
          title: "This patient has not returned in 30 days",
          description: `${patient.full_name} may need a simple check-in or next-session reminder.`,
          priority: daysSinceLastSession >= 45 ? "high" : "medium",
          category: "patient",
          entity_type: "patient",
          entity_id: patient.id,
          suggested_url: `/patients/${patient.id}`,
          reason: `Last recorded session was ${daysSinceLastSession} days ago.`,
        });
      }

      if (!latestAppointment) {
        drafts.push({
          clinic_id: input.clinicId,
          action_key: `patient_no_session:${patient.id}`,
          title: "Give this patient a next step",
          description: `${patient.full_name} is active but has no session on record yet.`,
          priority: "low",
          category: "patient",
          entity_type: "patient",
          entity_id: patient.id,
          suggested_url: `/patients/${patient.id}`,
          reason: "Active patients should have a session, note, or follow-up path.",
        });
      }
    });

  return drafts.slice(0, 20);
}
