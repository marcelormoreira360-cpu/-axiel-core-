"use server";

import { redirect } from "next/navigation";
import { createAppointment } from "@/services/appointment-service";
import { getCurrentClinic } from "@/services/clinic-service";

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string };
    return [e.message, e.details, e.hint].filter(Boolean).join(" · ") || "Não foi possível iniciar a sessão.";
  }
  return "Não foi possível iniciar a sessão. Tente novamente.";
}

/**
 * Inicia uma NOVA sessão presencial para o paciente NA HORA.
 *
 * Contexto: `session_records.appointment_id` é UNIQUE (1 sessão por agendamento).
 * O botão "Registrar sessão" reabre a sessão mais recente; quando só existe a 1ª
 * (pós-avaliação) e nenhum agendamento futuro está marcado, ele reabre sempre a
 * mesma. Esta ação cria o agendamento de AGORA e leva direto ao registro em branco.
 *
 * Usa `skipSideEffects: true` — a sessão já está acontecendo, então não dispara
 * confirmação por e-mail/WhatsApp nem questionários de onboarding ao paciente.
 */
export async function startNewSessionAction(patientId: string) {
  const clinic = await getCurrentClinic();
  if (!clinic) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent("Clínica não encontrada. Faça login novamente.")}`);
  }

  let appointmentId: string;
  try {
    const appt = await createAppointment({
      clinic_id: clinic.id,
      patient_id: patientId,
      starts_at: new Date().toISOString(), // agora (UTC) — é o instante real, sem conversão wall-clock
      duration_minutes: 60,
      source: "direct",
      skipSideEffects: true,
      // Atendimento presencial que já começou: não bloquear por sobreposição de
      // horário (o check casaria com qualquer sessão em curso na clínica).
      skipConflictCheck: true,
    });
    appointmentId = appt.id;
  } catch (error) {
    // Volta à ficha com a mensagem, sem quebrar a tela (nunca estoura no global-error).
    redirect(`/patients/${patientId}?error=${encodeURIComponent(describeError(error))}`);
  }

  // Sessão em branco do agendamento recém-criado.
  redirect(`/schedule/${appointmentId}/session`);
}
