import type { Appointment, FollowUp, Lead, Patient } from "@/lib/types";

export type CommunicationChannel = "email" | "sms";
export type CommunicationUseCase = "appointment_reminder" | "appointment_confirmation" | "follow_up" | "lead_nurturing" | "package_low";

export const communicationUseCaseLabels: Record<CommunicationUseCase, string> = {
  appointment_reminder: "Lembrete de sessão",
  appointment_confirmation: "Confirmação de agendamento",
  follow_up: "Acompanhamento",
  lead_nurturing: "Nutrição de lead",
  package_low: "Pacote encerrando",
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
    name: "Lembrete de sessão — e-mail",
    channel: "email",
    use_case: "appointment_reminder",
    subject: "Lembrete da sua sessão",
    body: "Olá, {{name}}! Este é um lembrete da sua sessão agendada para {{date}} às {{time}}. Qualquer dúvida, é só responder este e-mail.",
  },
  {
    key: "appointment_reminder_sms",
    name: "Lembrete de sessão — SMS",
    channel: "sms",
    use_case: "appointment_reminder",
    subject: null,
    body: "Olá, {{name}}! Lembrete: sua sessão está marcada para {{date}} às {{time}}. Responda se precisar de ajuda.",
  },
  {
    key: "follow_up_email",
    name: "Acompanhamento pós-sessão — e-mail",
    channel: "email",
    use_case: "follow_up",
    subject: "Como você está?",
    body: "Olá, {{name}}! Estamos passando para saber como você está após a sua última visita. Se quiser agendar o próximo passo, é só responder este e-mail.",
  },
  {
    key: "follow_up_sms",
    name: "Acompanhamento pós-sessão — SMS",
    channel: "sms",
    use_case: "follow_up",
    subject: null,
    body: "Olá, {{name}}! Como você está depois da última sessão? Responda aqui se quiser ajuda para agendar o próximo passo.",
  },
  {
    key: "lead_nurturing_email",
    name: "Nutrição de lead — e-mail",
    channel: "email",
    use_case: "lead_nurturing",
    subject: "Como podemos ajudar?",
    body: "Olá, {{name}}! Obrigado pelo seu contato. Será um prazer ajudá-lo(a) a dar o próximo passo. Responda este e-mail e conversamos.",
  },
  {
    key: "lead_nurturing_sms",
    name: "Nutrição de lead — SMS",
    channel: "sms",
    use_case: "lead_nurturing",
    subject: null,
    body: "Olá, {{name}}! Obrigado pelo contato. Responda aqui e podemos ajudá-lo(a) a escolher o próximo passo simples.",
  },
];

function formatDate(value?: string | null) {
  if (!value) return "horário agendado";
  return new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function renderCommunicationTemplate(template: string, variables: Record<string, string | null | undefined>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? "");
}

export function buildPatientVariables(patient?: Pick<Patient, "full_name" | "email" | "phone"> | null, appointment?: Pick<Appointment, "starts_at" | "duration_minutes"> | null) {
  return {
    name: patient?.full_name ?? "você",
    email: patient?.email ?? "",
    phone: patient?.phone ?? "",
    date: formatDate(appointment?.starts_at),
    time: formatTime(appointment?.starts_at),
    duration: appointment?.duration_minutes ? `${appointment.duration_minutes} minutos` : "",
  };
}

export function buildLeadVariables(lead?: Pick<Lead, "full_name" | "email" | "phone" | "source"> | null) {
  return {
    name: lead?.full_name ?? "você",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    source: lead?.source ?? "",
  };
}

export function getRecipientForChannel(channel: CommunicationChannel, contact: { email?: string | null; phone?: string | null }) {
  return channel === "email" ? contact.email : contact.phone;
}

export const SIMPLE_MESSAGE_RULES = [
  "Use linguagem curta e amigável.",
  "Não inclua orientações médicas, diagnósticos ou instruções clínicas.",
  "Sempre permita que a pessoa responda ou entre em contato com a clínica.",
];
