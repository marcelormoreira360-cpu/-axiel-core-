import type { Appointment, FollowUp, Lead, Patient } from "@/lib/types";
import { leadStageLabels } from "@/modules/leads/lead-pipeline";
import { patientStatusLabel } from "@/modules/patients/patient-status";

type InsightItem = { title: string; text: string };

type PanelData = {
  summary: string;
  patterns: InsightItem[];
  nextSteps: InsightItem[];
};

export function getDashboardAiInsights(input: {
  patients: Patient[];
  leads: Lead[];
  appointments: Appointment[];
  followUps: FollowUp[];
}): PanelData {
  const activePatients = input.patients.filter((patient) => patient.status === "active");
  const conversionLeads = input.leads.filter((lead) => lead.stage === "scheduled" || lead.stage === "contacted");
  const pendingFollowUps = input.followUps.filter((followUp) => followUp.status === "pending");

  return {
    summary: "This panel will guide the clinic team toward the most useful operational action. It does not make clinical decisions.",
    patterns: [
      {
        title: "Daily workload",
        text: `${input.appointments.length} session${input.appointments.length === 1 ? "" : "s"} are visible in the current schedule view.`,
      },
      {
        title: "Follow-up demand",
        text: `${pendingFollowUps.length} patient${pendingFollowUps.length === 1 ? "" : "s"} need a simple follow-up action.`,
      },
      {
        title: "Growth opportunity",
        text: `${conversionLeads.length} lead${conversionLeads.length === 1 ? "" : "s"} are close enough to deserve attention.`,
      },
    ],
    nextSteps: [
      {
        title: pendingFollowUps.length > 0 ? "Contact follow-ups first" : "Create follow-up rhythm",
        text: pendingFollowUps.length > 0 ? "Start with patients already waiting for contact." : "Use follow-ups after sessions to keep the patient journey clear.",
      },
      {
        title: conversionLeads.length > 0 ? "Move warm leads forward" : "Build lead momentum",
        text: conversionLeads.length > 0 ? "Review contacted or scheduled leads and guide them to the next clear step." : "Add new leads and keep the pipeline moving visually.",
      },
      {
        title: activePatients.length > 0 ? "Review active patients" : "Add first active patient",
        text: activePatients.length > 0 ? "Make sure each active patient has a next session or follow-up." : "Start with one patient record so the system becomes practical immediately.",
      },
    ],
  };
}

export function getPatientAiInsights(input: {
  patient: Patient;
  appointments: Appointment[];
  followUps: FollowUp[];
  intakeResponseCount: number;
  sessionRecordCount: number;
}): PanelData {
  return {
    summary: `${input.patient.full_name} is marked as ${patientStatusLabel(input.patient)}. The panel will summarize intake, notes, session history, and follow-up activity in simple language.`,
    patterns: [
      {
        title: "Record completeness",
        text: `${input.intakeResponseCount} intake response${input.intakeResponseCount === 1 ? "" : "s"} and ${input.sessionRecordCount} session note${input.sessionRecordCount === 1 ? "" : "s"} are available for review.`,
      },
      {
        title: "Session history",
        text: `${input.appointments.length} session${input.appointments.length === 1 ? "" : "s"} are connected to this patient.`,
      },
      {
        title: "Follow-up visibility",
        text: `${input.followUps.filter((item) => item.status === "pending").length} pending follow-up${input.followUps.filter((item) => item.status === "pending").length === 1 ? "" : "s"} are connected to this record.`,
      },
    ],
    nextSteps: [
      {
        title: "Keep next step visible",
        text: input.followUps.some((item) => item.status === "pending") ? "Complete or update the pending follow-up." : "Create a follow-up if the patient needs a future touchpoint.",
      },
      {
        title: "Document the interaction",
        text: "Add short notes and key observations after each session to improve continuity.",
      },
    ],
  };
}

export function getLeadProfileAiInsights(lead: Lead): PanelData {
  const stage = leadStageLabels[lead.stage];
  const warm = lead.stage === "contacted" || lead.stage === "scheduled";

  return {
    summary: `${lead.full_name} is currently in the ${stage} stage. This panel will help the team decide the next non-medical business action.`,
    patterns: [
      {
        title: "Pipeline stage",
        text: warm ? "This lead has already moved beyond the first stage and may be ready for a clear next step." : "This lead is early in the pipeline and needs a first human touchpoint.",
      },
      {
        title: "Lead source",
        text: `The lead came from ${lead.source}. Future AI can compare source quality across the clinic.`,
      },
      {
        title: "Contact readiness",
        text: lead.phone || lead.email ? "At least one contact method is available." : "No contact method is saved yet; add one before follow-up.",
      },
    ],
    nextSteps: [
      {
        title: lead.stage === "new_lead" ? "Make first contact" : lead.stage === "contacted" ? "Offer scheduling" : lead.stage === "scheduled" ? "Prepare intake" : "Complete conversion review",
        text: lead.stage === "converted_to_patient" ? "Confirm the patient profile is complete." : "Use one simple action to move this person forward without overwhelming the team.",
      },
    ],
  };
}
