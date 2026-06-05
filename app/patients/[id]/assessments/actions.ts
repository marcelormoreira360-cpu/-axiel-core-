"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { sendAssessmentsToPatient } from "@/services/onboarding-assessment-service";

// Reenvia um questionário ao paciente (reavaliação) — gera novo convite e manda
// o link por WhatsApp/e-mail. A nova resposta vira um ponto na curva de progresso.
export async function resendAssessmentAction(
  patientId: string,
  templateId: string,
): Promise<{ error?: string; sent?: number }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };
  try {
    const { sent } = await sendAssessmentsToPatient({
      clinicId: clinic.id,
      patientId,
      templateIds: [templateId],
    });
    revalidatePath(`/patients/${patientId}`);
    if (sent === 0) return { error: "Já há um convite em aberto para este questionário." };
    return { sent };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao reenviar questionário." };
  }
}
