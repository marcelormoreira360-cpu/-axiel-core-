"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { createPrescription, deactivatePrescription, deletePrescription } from "@/services/exams-service";

export async function addPrescriptionAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const type = String(formData.get("type") ?? "supplement") as "medication" | "supplement";
  const name = String(formData.get("name") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim() || null;
  const frequency = String(formData.get("frequency") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return;

  await createPrescription({
    patient_id: patientId,
    clinic_id: profile.clinic_id,
    type,
    name,
    dosage,
    frequency,
    start_date: startDate,
    notes,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function deactivatePrescriptionAction(id: string, patientId: string) {
  await deactivatePrescription(id);
  revalidatePath(`/patients/${patientId}`);
}

export async function deletePrescriptionAction(id: string, patientId: string) {
  await deletePrescription(id);
  revalidatePath(`/patients/${patientId}`);
}
