"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { createPatientPackage, deactivatePatientPackage, deletePatientPackage } from "@/services/package-service";

export async function addPackageAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sessionsTotal = parseInt(String(formData.get("sessions_total") ?? "0"), 10);
  const startDate = String(formData.get("start_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;

  if (!name || !sessionsTotal || !startDate) return;

  await createPatientPackage({
    patient_id: patientId,
    clinic_id: profile.clinic_id,
    name,
    sessions_total: sessionsTotal,
    start_date: startDate,
    notes,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function deactivatePackageAction(id: string, patientId: string) {
  await deactivatePatientPackage(id);
  revalidatePath(`/patients/${patientId}`);
}

export async function deletePackageAction(id: string, patientId: string) {
  await deletePatientPackage(id);
  revalidatePath(`/patients/${patientId}`);
}
