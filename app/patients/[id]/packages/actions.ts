"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { createPatientPackage, deactivatePatientPackage, deletePatientPackage } from "@/services/package-service";

export async function addPackageAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sessionsTotal = parseInt(String(formData.get("sessions_total") ?? "0"), 10);
  const startDate = String(formData.get("start_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const autoRenew = formData.get("auto_renew") === "true";

  if (!name || !sessionsTotal || !startDate) return;

  await createPatientPackage({
    patient_id: patientId,
    clinic_id: profile.clinic_id,
    name,
    sessions_total: sessionsTotal,
    start_date: startDate,
    notes,
    auto_renew: autoRenew,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function deactivatePackageAction(id: string, patientId: string) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("Clínica não encontrada.");
  await deactivatePatientPackage(id, clinic.id);
  revalidatePath(`/patients/${patientId}`);
}

export async function deletePackageAction(id: string, patientId: string) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("Clínica não encontrada.");
  await deletePatientPackage(id, clinic.id);
  revalidatePath(`/patients/${patientId}`);
}
