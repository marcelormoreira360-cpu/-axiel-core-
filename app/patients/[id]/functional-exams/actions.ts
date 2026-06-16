"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  createPatientFunctionalExam,
  deletePatientFunctionalExam,
  type FunctionalExamType,
} from "@/services/functional-exams-service";

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
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const examDate = String(formData.get("exam_date") ?? "") || new Date().toISOString().slice(0, 10);

  if (!patientId) throw new Error("Paciente obrigatório");
  if (!summary && !title) throw new Error("Descreva os achados do exame.");

  await createPatientFunctionalExam({
    clinic_id: profile.clinic_id,
    patient_id: patientId,
    exam_type: examType,
    title,
    summary,
    exam_date: examDate,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function deleteFunctionalExamAction(examId: string, patientId: string) {
  await deletePatientFunctionalExam(examId);
  revalidatePath(`/patients/${patientId}`);
}
