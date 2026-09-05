"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  createPatientFunctionalExam,
  uploadFunctionalExamFile,
  deletePatientFunctionalExam,
  reviewExamMetrics,
  createFunctionalExamUploadTicket,
  downloadFunctionalExamFile,
  functionalExamPathPrefix,
  type FunctionalExamType,
} from "@/services/functional-exams-service";
import { analyzeExamPdf, extractExamMetrics } from "@/services/exam-ai-service";
import { getPatientById } from "@/services/patient-service";
import { resolvePatientLocale } from "@/lib/email-i18n";
import { coerceExamMetricsDraft, type ExamInstrument } from "@/modules/neuro-id/exam-metrics";

const TYPES: FunctionalExamType[] = ["neurometria", "biorressonancia", "teste_capilar", "outro"];

// A IA que lê o PDF é best-effort: se estourar este tempo, salvamos o exame SEM
// a síntese em vez de deixar a função da Vercel morrer por timeout (que caía no
// "Algo deu errado" e ainda deixava o arquivo subido sem registro). Fica abaixo
// do maxDuration da rota (60s) para sobrar tempo de gravar o exame depois.
const AI_EXAM_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Prepara o upload DIRETO do PDF do exame (navegador → storage), contornando o
 * limite de ~4,5 MB de corpo das funções serverless da Vercel. Retorna um path +
 * token de URL assinada; o cliente sobe o arquivo e depois manda só o path para
 * addFunctionalExamAction. Exames Neuro ID têm 5–10 MB, então isso é obrigatório.
 */
export async function createExamUploadUrlAction(
  patientId: string,
  filename: string,
): Promise<{ ok: boolean; path?: string; token?: string; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ok: false, error: "Não autorizado." };
  if (!patientId) return { ok: false, error: "Paciente obrigatório." };
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) return { ok: false, error: "Paciente não encontrado." };
  try {
    const ticket = await createFunctionalExamUploadTicket(filename, patientId, profile.clinic_id);
    return { ok: true, path: ticket.path, token: ticket.token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao preparar o upload." };
  }
}

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
  // Caminho preferido: o navegador já subiu o PDF DIRETO no storage (contorna o
  // limite de 4,5 MB da Vercel) e manda só o `storage_path`. Caminho legado:
  // arquivo pequeno vindo no próprio form.
  let filePath: string | null = null;
  let aiAnalysis: string | null = null;
  let metricsDraft: Record<string, number> = {};
  let pdfBase64: string | null = null;
  let pdfName = "exame.pdf";

  const storagePath = String(formData.get("storage_path") ?? "").trim();
  const file = formData.get("exam_file");

  if (storagePath) {
    // Segurança: o path precisa pertencer a ESTA clínica/paciente (o cliente o envia).
    if (!storagePath.startsWith(functionalExamPathPrefix(profile.clinic_id, patientId))) {
      throw new Error("Arquivo inválido.");
    }
    filePath = storagePath;
    pdfName = String(formData.get("file_name") ?? "").trim() || "exame.pdf";
    pdfBase64 = (await downloadFunctionalExamFile(storagePath)).toString("base64");
  } else if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf") throw new Error("Anexe o exame em PDF.");
    const buffer = Buffer.from(await file.arrayBuffer());
    pdfBase64 = buffer.toString("base64");
    pdfName = file.name;
    filePath = await uploadFunctionalExamFile(buffer, file.name, file.type, patientId, profile.clinic_id);
  }

  if (pdfBase64) {
    // A síntese entra no Relatório Funcional do PACIENTE → idioma do paciente.
    const patient = await getPatientById(patientId, profile.clinic_id);
    const patientLocale = await resolvePatientLocale(patient?.locale, profile.clinic_id);
    [aiAnalysis, metricsDraft] = await Promise.all([
      withTimeout(analyzeExamPdf({ pdfBase64, filename: pdfName, examType, examTitle: title, locale: patientLocale }), AI_EXAM_TIMEOUT_MS, null),
      withTimeout(extractExamMetrics({ pdfBase64, filename: pdfName, examType }), AI_EXAM_TIMEOUT_MS, {}),
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
