"use server";

import { revalidatePath } from "next/cache";
import { resolveLocale } from "@/i18n/get-locale";
import { updatePatient, getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { buildAiInsightInput, suggestCaseSummary, type AiInsightInputSnapshot } from "@/services/ai-insight-service";

export type CaseSummaryState = { error?: string; ok?: boolean } | null;

// Estado do rascunho por IA (READ-ONLY: não grava). `no_assessment` sinaliza que
// falta preencher a avaliação; a UI traduz isso na mensagem ao terapeuta.
export type CaseSummaryDraftState =
  | { ok: true; chief: string; summary: string }
  | { ok: false; reason: "no_assessment" | "unauthorized" };

// Há sinal de avaliação suficiente para a IA rascunhar? (objetivo/anamnese/ATM,
// campos personalizados, Mapa Neuro ID, questionários ou intake preenchidos).
function hasAssessmentSignal(s: AiInsightInputSnapshot): boolean {
  const p = s.patient;
  return (
    s.patient.assessment_extra.length > 0 ||
    Boolean(p.anamnese || p.antecedents || p.treatment_note || p.pain_location) ||
    p.pain_level != null ||
    s.neuro_id != null ||
    s.intake.length > 0 ||
    s.assessments.length > 0 ||
    s.functional_exams.some((f) => f.summary)
  );
}

/**
 * Gera um RASCUNHO de queixa + resumo do caso a partir da avaliação (IA, com
 * fallback determinístico). READ-ONLY: NÃO grava e NÃO revalida. O terapeuta
 * revisa e salva pelo fluxo normal (saveCaseSummaryAction). Escopo de clínica
 * garantido por getPatientById(clinic.id) + buildAiInsightInput (por clínica).
 */
export async function draftCaseSummaryAction(patientId: string): Promise<CaseSummaryDraftState> {
  const clinic = await getCurrentClinic();
  if (!clinic?.id) return { ok: false, reason: "unauthorized" };
  const patient = await getPatientById(patientId, clinic.id);
  if (!patient) return { ok: false, reason: "unauthorized" };

  const snapshot = await buildAiInsightInput(patientId);
  if (!snapshot || !hasAssessmentSignal(snapshot)) return { ok: false, reason: "no_assessment" };

  // Rascunho INTERNO (terapeuta lê): idioma da clínica (locale da UI).
  const { chief, summary } = await suggestCaseSummary(snapshot, await resolveLocale());
  // hasAssessmentSignal conta intake/questionários, mas o fallback determinístico
  // só lê objetivo/anamnese/ATM/Neuro ID/medicamentos. Sem chave da IA, o rascunho
  // pode vir vazio mesmo com sinal: nesse caso sinaliza "preencha a avaliação" em
  // vez de exibir um rascunho em branco como "preenchido".
  if (!chief.trim() && !summary.trim()) return { ok: false, reason: "no_assessment" };
  return { ok: true, chief, summary };
}

// Salva queixa principal + resumo do caso (Feature 2). Escopo de clínica é
// garantido dentro de updatePatient (resolve a clínica do usuário autenticado).
export async function saveCaseSummaryAction(
  patientId: string,
  _prev: CaseSummaryState,
  formData: FormData,
): Promise<CaseSummaryState> {
  try {
    const chief = String(formData.get("chief_complaint") ?? "").trim();
    const summary = String(formData.get("case_summary") ?? "").trim();
    await updatePatient(patientId, {
      chief_complaint: chief || null,
      case_summary: summary || null,
    });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }
}
