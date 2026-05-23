import type { Appointment, FollowUp, Patient } from "@/lib/types";

/** Rule-based timing suggestion (not AI-generated). */
export const FOLLOW_UP_AI_LABEL = "Sugestão: próximo acompanhamento";

export function getSuggestedFollowUpTimingPlaceholder(input: {
  patient: Patient;
  appointments?: Appointment[];
  followUps?: FollowUp[];
}) {
  const lastAppointment = input.appointments?.[0];
  const pendingFollowUp = input.followUps?.find((item) => item.status === "pending");

  if (pendingFollowUp) {
    return "Já existe um acompanhamento pendente. Revise-o antes de criar outro lembrete.";
  }

  if (lastAppointment) {
    return "Sugestão de timing: revise este paciente entre 7 e 14 dias após a última sessão.";
  }

  return "Sugestão de timing: agende o primeiro acompanhamento após a criação da sessão inicial.";
}

export function getFollowUpReviewPrompts() {
  return [
    "Confirme se o paciente precisa de um lembrete para a próxima sessão.",
    "Escolha e-mail ou SMS se uma mensagem precisar ser redigida depois.",
    "Revise o timing manualmente antes de enviar qualquer coisa.",
  ];
}
