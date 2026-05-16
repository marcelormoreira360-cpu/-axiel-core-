import type { Appointment, FollowUp, Lead, Patient } from "@/lib/types";

export type CommunicationChannel = "email" | "sms";
export type CommunicationUseCase = "appointment_reminder" | "follow_up" | "lead_nurturing";

export const communicationUseCaseLabels: Record<CommunicationUseCase, string> = {
  appointment_reminder: "Appointment reminder",
  follow_up: "Follow-up",
  lead_nurturing: "Lead nurturing",
};

export const defaultCommunicationTemplates: Array<{
  key: string;
  name: string;
  channel: CommunicationChannel;
  use_case: CommunicationUseCase;
  subject: string | null;
  body: string;
}> = [
  {
    key: "appointment_reminder_email",
    name: "Appointment reminder email",
    channel: "email",
    use_case: "appointment_reminder",
    subject: "Your upcoming appointment",
    body: "Hi {{name}}, this is a friendly reminder for your appointment on {{date}} at {{time}}. Reply if you need help.",
  },
  {
    key: "appointment_reminder_sms",
    name: "Appointment reminder SMS",
    channel: "sms",
    use_case: "appointment_reminder",
    subject: null,
    body: "Hi {{name}}, reminder: your appointment is on {{date}} at {{time}}. Reply if you need help.",
  },
  {
    key: "follow_up_email",
    name: "Follow-up email",
    channel: "email",
    use_case: "follow_up",
    subject: "Checking in",
    body: "Hi {{name}}, just checking in after your visit. Let us know if you would like help scheduling your next step.",
  },
  {
    key: "follow_up_sms",
    name: "Follow-up SMS",
    channel: "sms",
    use_case: "follow_up",
    subject: null,
    body: "Hi {{name}}, checking in after your visit. Reply if you would like help with your next step.",
  },
  {
    key: "lead_nurturing_email",
    name: "Lead nurturing email",
    channel: "email",
    use_case: "lead_nurturing",
    subject: "How can we help?",
    body: "Hi {{name}}, thank you for reaching out. We would be happy to help you choose the next simple step.",
  },
  {
    key: "lead_nurturing_sms",
    name: "Lead nurturing SMS",
    channel: "sms",
    use_case: "lead_nurturing",
    subject: null,
    body: "Hi {{name}}, thank you for reaching out. Reply here and we can help you choose the next simple step.",
  },
];

function formatDate(value?: string | null) {
  if (!value) return "your scheduled time";
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function renderCommunicationTemplate(template: string, variables: Record<string, string | null | undefined>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? "");
}

export function buildPatientVariables(patient?: Pick<Patient, "full_name" | "email" | "phone"> | null, appointment?: Pick<Appointment, "starts_at" | "duration_minutes"> | null) {
  return {
    name: patient?.full_name ?? "there",
    email: patient?.email ?? "",
    phone: patient?.phone ?? "",
    date: formatDate(appointment?.starts_at),
    time: formatTime(appointment?.starts_at),
    duration: appointment?.duration_minutes ? `${appointment.duration_minutes} minutes` : "",
  };
}

export function buildLeadVariables(lead?: Pick<Lead, "full_name" | "email" | "phone" | "source"> | null) {
  return {
    name: lead?.full_name ?? "there",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    source: lead?.source ?? "",
  };
}

export function getRecipientForChannel(channel: CommunicationChannel, contact: { email?: string | null; phone?: string | null }) {
  return channel === "email" ? contact.email : contact.phone;
}

export const SIMPLE_MESSAGE_RULES = [
  "Use short, friendly language.",
  "Do not include medical advice, diagnosis, or session instructions.",
  "Always let the person reply or contact the clinic.",
];
