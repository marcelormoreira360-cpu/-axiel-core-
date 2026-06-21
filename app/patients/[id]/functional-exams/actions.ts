"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  createPatientFunctionalExam,
  uploadFunctionalExamFile,
  deletePatientFunctionalExam,
  type FunctionalExamType,
} from "@/services/functional-exams-service";
import { analyzeExamPdf } from "@/services/exam-ai-service";

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

  // Anexo opcional do PDF do exame → a IA lê e extrai uma síntese concisa.
  let filePath: string | null = null;
  let aiAnalysis: string | null = null;
  const file = formData.get("exam_file");
  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf") throw new Error("Anexe o exame em PDF.");
    const buffer = Buffer.from(await file.arrayBuffer());
    filePath = await uploadFunctionalExamFile(buffer, file.name, file.type, patientId, profile.clinic_id);
    aiAnalysis = await analyzeExamPdf({
      pdfBase64: buffer.toString("base64"),
      filename: file.name,
      examType,
      examTitle: title,
    });
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
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function deleteFunctionalExamAction(examId: string, patientId: string) {
  await deletePatientFunctionalExam(examId);
  revalidatePath(`/patients/${patientId}`);
}
