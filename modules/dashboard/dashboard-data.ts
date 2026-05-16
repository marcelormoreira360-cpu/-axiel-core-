import type { Appointment, FollowUp, Lead, Patient } from "@/lib/types";
import { formatTime } from "@/modules/schedule/date-utils";
import { getAppointmentsForDay } from "@/modules/schedule/schedule-view";

export type ScheduleItem = {
  time: string;
  patientName: string;
  visitType: string;
  status: "ready" | "waiting" | "done";
};

export type SuggestedAction = {
  title: string;
  text: string;
  priority: "high" | "medium" | "low";
  href?: string;
};

export function getTodaySchedulePreview(appointments: Appointment[]): ScheduleItem[] {
  const today = getAppointmentsForDay(appointments, new Date());

  return today.map((appointment, index) => ({
    time: formatTime(appointment.starts_at),
    patientName: appointment.patients?.full_name ?? "Patient",
    visitType: `${appointment.duration_minutes} min generic session`,
    status: index === 0 ? "ready" : "waiting",
  }));
}

export function getNewLeads(leads: Lead[]): Lead[] {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentLeads = leads.filter((lead) => new Date(lead.created_at).getTime() >= sevenDaysAgo);
  return recentLeads.length > 0 ? recentLeads : leads.slice(0, 4);
}

export function getLeadsCloseToConversion(leads: Lead[]): Lead[] {
  return leads.filter((lead) => lead.stage === "scheduled" || lead.stage === "contacted").slice(0, 4);
}

export function getPatientsNeedingFollowUp(followUps: FollowUp[]): FollowUp[] {
  const now = Date.now();
  return followUps
    .filter((followUp) => followUp.status === "pending")
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    .filter((followUp) => new Date(followUp.due_at).getTime() <= now + 7 * 24 * 60 * 60 * 1000)
    .slice(0, 4);
}

export function getTodayPriorities(input: { appointments: Appointment[]; followUps: FollowUp[]; leads: Lead[] }): SuggestedAction[] {
  const todaySessions = getAppointmentsForDay(input.appointments, new Date());
  const followUps = getPatientsNeedingFollowUp(input.followUps);
  const warmLeads = getLeadsCloseToConversion(input.leads);

  const priorities: SuggestedAction[] = [];

  if (todaySessions.length > 0) {
    priorities.push({
      title: "Prepare today’s sessions",
      text: `${todaySessions.length} session${todaySessions.length === 1 ? "" : "s"} on the calendar. Open the first record before the appointment.`,
      priority: "high",
      href: "/schedule",
    });
  }

  if (followUps.length > 0) {
    priorities.push({
      title: "Contact patients waiting for follow-up",
      text: `${followUps.length} follow-up${followUps.length === 1 ? "" : "s"} need attention soon.`,
      priority: "high",
      href: "/follow-ups",
    });
  }

  if (warmLeads.length > 0) {
    priorities.push({
      title: "Move warm leads forward",
      text: `${warmLeads.length} lead${warmLeads.length === 1 ? "" : "s"} may be ready for scheduling or conversion.`,
      priority: "medium",
      href: "/leads",
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      title: "Start with one clear action",
      text: "Add a patient, add a lead, or book a session. The system becomes useful immediately after one record is created.",
      priority: "low",
      href: "/get-started",
    });
  }

  return priorities.slice(0, 3);
}

export function getNextBestAction(input: { patients: Patient[]; leads: Lead[]; appointments: Appointment[]; followUps: FollowUp[] }): SuggestedAction {
  const priorities = getTodayPriorities({ appointments: input.appointments, followUps: input.followUps, leads: input.leads });
  if (priorities.length > 0) return priorities[0];

  const activePatients = input.patients.filter((patient) => patient.status === "active");
  if (activePatients.length > 0) {
    return { title: "Review active patients", text: "Make sure each active patient has a next session or follow-up.", priority: "medium", href: "/patients" };
  }

  return { title: "Complete setup", text: "Use guided onboarding to create the first working version of your clinic system.", priority: "low", href: "/onboarding" };
}

export function getSuggestedActions(patients: Patient[], leads: Lead[]): SuggestedAction[] {
  const scheduledLeads = leads.filter((lead) => lead.stage === "scheduled");
  const activePatients = patients.filter((patient) => patient.status === "active");

  const actions: SuggestedAction[] = [];

  if (scheduledLeads.length > 0) {
    actions.push({
      title: "Review scheduled leads",
      text: `${scheduledLeads.length} lead${scheduledLeads.length === 1 ? "" : "s"} already scheduled and ready for intake preparation.`,
      priority: "high",
      href: "/leads",
    });
  }

  if (activePatients.length > 0) {
    actions.push({
      title: "Review active patients",
      text: `${activePatients.length} active patient${activePatients.length === 1 ? "" : "s"} need clear next steps.`,
      priority: "medium",
      href: "/patients",
    });
  }

  actions.push({
    title: "AI placeholder",
    text: "Future AI will suggest next visits, follow-ups, and retention actions.",
    priority: "low",
    href: "/dashboard",
  });

  return actions.slice(0, 3);
}
