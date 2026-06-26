"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { getPatientById } from "@/services/patient-service";
import { createNeuroIdAssessment, updateNeuroIdAssessment, segmentInstruments, importQuestionnaireAnswers, type QuestionnaireImport } from "@/services/neuro-id-service";

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
 * "Rever / editar": corrige a MESMA avaliação (não cria reavaliação). Recebe o
 * assessment_id + os itens preenchidos e regrava valores/scores in-place.
 */
export async function updateNeuroIdAssessmentAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!patientId) throw new Error("Paciente obrigatório");
  if (!assessmentId) throw new Error("Avaliação obrigatória");

  // Hardening: paciente precisa pertencer à clínica do usuário (RLS-scoped).
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) throw new Error("Paciente não encontrado nesta clínica.");

  const values: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (!key.startsWith("item__")) continue;
    const raw = String(val).trim();
    if (raw === "") continue;
    values[key.slice("item__".length)] = raw;
  }

  await updateNeuroIdAssessment({
    assessmentId,
    clinicId: profile.clinic_id,
    patientId,
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

/**
 * §8: importa as respostas de questionário do paciente → rascunho 0–10 (auto)
 * para revisão humana. NÃO grava; a gravação ocorre no createNeuroIdAssessmentAction.
 */
export async function importQuestionnaireAnswersAction(
  patientId: string,
): Promise<QuestionnaireImport & { error?: string }> {
  const empty: QuestionnaireImport = { draft: {}, sources: {}, origins: {}, missing: [], unanswered: [], phq9Item9: null };
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ...empty, error: "Não autorizado." };
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) return { ...empty, error: "Paciente não encontrado nesta clínica." };
  try {
    return await importQuestionnaireAnswers(patientId, profile.clinic_id);
  } catch {
    return { ...empty, error: "Não foi possível importar as respostas agora." };
  }
}
