import type { FollowUpChannel, Patient } from "@/lib/types";

export function buildFollowUpMessagePlaceholder(patient: Pick<Patient, "full_name">, channel: FollowUpChannel) {
  if (channel === "none") {
    return { subject: null, body: null };
  }

  if (channel === "sms") {
    return {
      subject: null,
      body: `Olá, ${patient.full_name}! Como você está depois da última sessão? Responda aqui se quiser ajuda para agendar o próximo passo.`,
    };
  }

  return {
    subject: "Como você está?",
    body: `Olá, ${patient.full_name}! Estamos passando para saber como você está após a sua última visita. Se quiser agendar o próximo passo, é só responder este e-mail.`,
  };
}

export const MESSAGE_AUTOMATION_STATUS = "Pronto para envio manual. Regras de automação podem ser adicionadas depois.";
