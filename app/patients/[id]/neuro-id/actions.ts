"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { getPatientById } from "@/services/patient-service";
import { createNeuroIdAssessment, segmentInstruments } from "@/services/neuro-id-service";

export async function createNeuroIdAssessmentAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  if (!patientId) throw new Error("Paciente obrigatório");

  // Hardening: paciente precisa pertencer à clínica do usuário (RLS-scoped).
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) throw new Error("Paciente não encontrado nesta clínica.");

  // Campos vêm como item__<code>. Mantém só os preenchidos.
  const values: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (!key.startsWith("item__")) continue;
    const raw = String(val).trim();
    if (raw === "") continue;
    values[key.slice("item__".length)] = raw;
  }

  await createNeuroIdAssessment({
    clinicId: profile.clinic_id,
    patientId,
    createdBy: profile.id,
    values,
  });

  revalidatePath(`/patients/${patientId}`);
}

/**
 * Fase 2: IA extrai sub-scores do QRM/Q-SNA colados → rascunho 0–10 para revisão
 * humana. NÃO grava nada; só devolve o rascunho (a gravação acontece quando o
 * terapeuta confirma via createNeuroIdAssessmentAction).
 */
export async function segmentInstrumentsAction(input: {
  qrmText?: string;
  qsnaText?: string;
}): Promise<{ draft: Record<string, number>; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { draft: {}, error: "Não autorizado." };
  try {
    const draft = await segmentInstruments(input);
    return { draft };
  } catch {
    return { draft: {}, error: "Não foi possível extrair agora. Tente novamente ou preencha manualmente." };
  }
}
