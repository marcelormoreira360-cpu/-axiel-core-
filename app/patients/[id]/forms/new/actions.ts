"use server";

import { redirect } from "next/navigation";
import { submitAssessmentResponse } from "@/services/assessment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import type { TemplateWithStructure } from "@/lib/types";

export async function submitFormAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clinic required");

  const templateJson = String(formData.get("template_json") ?? "");
  const patientId = String(formData.get("patient_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const template: TemplateWithStructure = JSON.parse(templateJson);

  const answers: {
    question_id: string;
    section_id: string | null;
    value_number: number | null;
    value_text: string | null;
  }[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  const sectionScores: Record<string, { title: string; score: number; max: number }> = {};

  for (const section of template.assessment_sections) {
    let sectionScore = 0;
    let sectionMax = 0;
    for (const q of section.assessment_questions) {
      const raw = formData.get(`q_${q.id}`);
      let valueNumber: number | null = null;
      let valueText: string | null = null;
      if (q.question_type === "text") {
        valueText = raw ? String(raw) : null;
      } else {
        valueNumber = raw !== null && raw !== "" ? Number(raw) : null;
      }
      answers.push({
        question_id: q.id,
        section_id: section.id,
        value_number: valueNumber,
        value_text: valueText,
      });
      if (valueNumber !== null && q.question_type !== "text") {
        sectionScore += valueNumber;
        totalScore += valueNumber;
      }
      if (q.question_type !== "text") {
        sectionMax += q.max_score;
        maxPossibleScore += q.max_score;
      }
    }
    sectionScores[section.id] = { title: section.title, score: sectionScore, max: sectionMax };
  }

  const response = await submitAssessmentResponse({
    template_id: template.id,
    patient_id: patientId,
    clinic_id: profile.clinic_id,
    answers,
    section_scores: sectionScores,
    total_score: totalScore,
    max_possible_score: maxPossibleScore,
    notes,
  });

  // Auto-gerar/atualizar o Mapa Bio³ (rascunho parcial) quando o terapeuta
  // preenche o questionário DENTRO do app — mesmo gatilho do submit público.
  // Idempotente (um auto_draft por paciente); silencioso e não derruba o fluxo.
  try {
    const { autoUpsertNeuroIdDraft } = await import("@/services/neuro-id-service");
    await autoUpsertNeuroIdDraft(patientId, profile.clinic_id);
  } catch (e) {
    console.error("Bio3 auto-draft (form in-app) falhou:", e);
  }

  redirect(`/patients/${patientId}/forms/${response.id}`);
}
