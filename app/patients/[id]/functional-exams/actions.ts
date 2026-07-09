"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  createPatientFunctionalExam,
  uploadFunctionalExamFile,
  deletePatientFunctionalExam,
  reviewExamMetrics,
  type FunctionalExamType,
} from "@/services/functional-exams-service";
import { analyzeExamPdf, extractExamMetrics } from "@/services/exam-ai-service";
import { getPatientById } from "@/services/patient-service";
import { resolvePatientLocale } from "@/lib/email-i18n";
import { coerceExamMetricsDraft, type ExamInstrument } from "@/modules/neuro-id/exam-metrics";

const TYPES: FunctionalExamType[] = ["neurometria", "biorressonancia", "outro"];

export async function addFunctionalExamAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const rawType = String(formData.get("exam_type") ?? "outro");
  const examType: FunctionalExamType = TYPES.includes(rawType as FunctionalExamType)
    ? (rawType as FunctionalExamType)
    : "outro";
  const title = String(formData.get("title") ?? "").trim() || null;
  let summary = String(formData.get("summary") ?? "").trim() || null;
  const examDate = String(formData.get("exam_date") ?? "") || new Date().toISOString().slice(0, 10);

  if (!patientId) throw new Error("Paciente obrigatório");

  // Anexo opcional do PDF do exame → a IA lê e extrai (a) uma síntese concisa e
  // (b) as métricas numéricas Bio³ (rascunho p/ gate humano antes da pirâmide).
  let filePath: string | null = null;
  let aiAnalysis: string | null = null;
  let metricsDraft: Record<string, number> = {};
  const file = formData.get("exam_file");
  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf") throw new Error("Anexe o exame em PDF.");
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfBase64 = buffer.toString("base64");
    filePath = await uploadFunctionalExamFile(buffer, file.name, file.type, patientId, profile.clinic_id);
    // A síntese entra no Relatório Funcional do PACIENTE → idioma do paciente.
    const patient = await getPatientById(patientId, profile.clinic_id);
    const patientLocale = await resolvePatientLocale(patient?.locale, profile.clinic_id);
    [aiAnalysis, metricsDraft] = await Promise.all([
      analyzeExamPdf({ pdfBase64, filename: file.name, examType, examTitle: title, locale: patientLocale }),
      extractExamMetrics({ pdfBase64, filename: file.name, examType }),
    ]);
    // Sem resumo manual? usa a síntese da IA (que o terapeuta pode editar depois).
    if (!summary && aiAnalysis) summary = aiAnalysis;
  }

  if (!summary && !title && !filePath) throw new Error("Anexe o PDF ou descreva os achados do exame.");

  await createPatientFunctionalExam({
    clinic_id: profile.clinic_id,
    patient_id: patientId,
    exam_type: examType,
    title,
    summary,
    exam_date: examDate,
    file_path: filePath,
    ai_analysis: aiAnalysis,
    metrics_draft: metricsDraft,
  });

  revalidatePath(`/patients/${patientId}`);
}

/**
 * Gate humano (incremento 4): o terapeuta revisa/edita as métricas extraídas pela
 * IA e CONFIRMA. Só depois disso elas entram na pirâmide Bio³. Os campos chegam por
 * `metric_code` no FormData; saneamos por code/faixa (coerceExamMetricsDraft) antes de gravar.
 */
export async function reviewExamMetricsAction(
  examId: string,
  patientId: string,
  examType: string,
  formData: FormData,
) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");
  if (examType !== "neurometria" && examType !== "biorressonancia") return;

  // Os campos do form são os próprios metric_codes; coerceExamMetricsDraft já
  // ignora codes desconhecidos e valores fora da faixa, então basta coletar os
  // não-vazios (codes ausentes/limpos = métrica removida do mapa).
  const raw: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (typeof val === "string" && val.trim() !== "") raw[key] = val.trim();
  }
  const values = coerceExamMetricsDraft(raw, examType as ExamInstrument);
  await reviewExamMetrics(examId, values);
  revalidatePath(`/patients/${patientId}`);
}

export async function deleteFunctionalExamAction(examId: string, patientId: string) {
  await deletePatientFunctionalExam(examId);
  revalidatePath(`/patients/${patientId}`);
}
