"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { createPatientExam, deletePatientExam } from "@/services/exams-service";
import { extractLabMarkers, type LabMarkerDraft } from "@/services/exam-ai-service";

// Lê a foto/PDF do exame e devolve os marcadores transcritos pela IA para o
// terapeuta REVISAR e validar. NÃO grava: a gravação é o addExamAction.
export async function extractLabMarkersAction(
  formData: FormData,
): Promise<{ markers: LabMarkerDraft[]; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { markers: [], error: "Não autorizado." };

  const file = formData.get("exam_file");
  if (!(file instanceof File) || file.size === 0) return { markers: [], error: "Anexe uma foto ou PDF do exame." };
  const okType = file.type === "application/pdf" || file.type.startsWith("image/");
  if (!okType) return { markers: [], error: "Use uma imagem (foto) ou PDF." };
  if (file.size > 15 * 1024 * 1024) return { markers: [], error: "Arquivo muito grande (máx. 15 MB)." };

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const markers = await extractLabMarkers({ fileBase64: base64, mimeType: file.type, filename: file.name });
    return { markers };
  } catch {
    return { markers: [], error: "Não foi possível ler o exame agora. Tente outra foto ou preencha manual." };
  }
}

export async function addExamAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const examDate = String(formData.get("exam_date") ?? "");
  const labName = String(formData.get("lab_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const resultsJson = String(formData.get("results") ?? "[]");
  const results = JSON.parse(resultsJson);

  await createPatientExam({
    patient_id: patientId,
    clinic_id: profile.clinic_id,
    exam_date: examDate,
    lab_name: labName,
    notes,
    results,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function deleteExamAction(examId: string, patientId: string) {
  await deletePatientExam(examId);
  revalidatePath(`/patients/${patientId}`);
}
