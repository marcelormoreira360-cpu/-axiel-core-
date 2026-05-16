"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { createPatientExam, deletePatientExam } from "@/services/exams-service";

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
