"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { createPatientExam, deletePatientExam } from "@/services/exams-service";
import { extractLabMarkers, type LabMarkerDraft } from "@/services/exam-ai-service";
import { getPatientById } from "@/services/patient-service";
import {
  createFunctionalExamUploadTicket,
  downloadFunctionalExamFile,
  deleteExamStorageFile,
  functionalExamPathPrefix,
} from "@/services/functional-exams-service";

/**
 * Prepara o upload DIRETO do arquivo do exame lab (navegador → storage), pra
 * contornar o limite de ~4,5 MB de corpo das funções da Vercel (foto de celular
 * passa fácil disso). O arquivo lab é temporário: extrai os marcadores e apaga.
 */
export async function createLabExamUploadUrlAction(
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

// Lê a foto/PDF do exame e devolve os marcadores transcritos pela IA para o
// terapeuta REVISAR e validar. NÃO grava o exame: a gravação é o addExamAction.
// Caminho preferido: o navegador já subiu o arquivo DIRETO no storage e manda o
// `storage_path`; aqui baixamos os bytes, lemos com a IA e APAGAMOS o temporário.
// Caminho legado: arquivo pequeno vindo no próprio form.
export async function extractLabMarkersAction(
  formData: FormData,
): Promise<{ markers: LabMarkerDraft[]; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { markers: [], error: "Não autorizado." };

  const patientId = String(formData.get("patient_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "").trim();

  let base64: string;
  let mimeType: string;
  let filename: string;

  if (storagePath) {
    if (!patientId || !storagePath.startsWith(functionalExamPathPrefix(profile.clinic_id, patientId))) {
      return { markers: [], error: "Arquivo inválido." };
    }
    mimeType = String(formData.get("file_type") ?? "application/pdf");
    filename = String(formData.get("file_name") ?? "exame");
    try {
      base64 = (await downloadFunctionalExamFile(storagePath)).toString("base64");
    } catch {
      await deleteExamStorageFile(storagePath).catch(() => {});
      return { markers: [], error: "Não foi possível ler o exame agora. Tente novamente." };
    }
    try {
      const markers = await extractLabMarkers({ fileBase64: base64, mimeType, filename });
      return { markers };
    } catch {
      return { markers: [], error: "Não foi possível ler o exame agora. Tente outra foto ou preencha manual." };
    } finally {
      // Exame lab não guarda o arquivo: apaga o temporário do storage.
      await deleteExamStorageFile(storagePath).catch(() => {});
    }
  }

  const file = formData.get("exam_file");
  if (!(file instanceof File) || file.size === 0) return { markers: [], error: "Anexe uma foto ou PDF do exame." };
  const okType = file.type === "application/pdf" || file.type.startsWith("image/");
  if (!okType) return { markers: [], error: "Use uma imagem (foto) ou PDF." };
  if (file.size > 15 * 1024 * 1024) return { markers: [], error: "Arquivo muito grande (máx. 15 MB)." };

  try {
    base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
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
