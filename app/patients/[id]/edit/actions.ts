"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updatePatient, anonymizePatient } from "@/services/patient-service";

export async function updatePatientAction(patientId: string, formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const date_of_birth = String(formData.get("date_of_birth") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active") as "active" | "inactive" | "archived";

  if (!full_name) return;

  await updatePatient(patientId, { full_name, email, phone, date_of_birth, notes, status });

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

export async function anonymizePatientAction(patientId: string): Promise<void> {
  "use server";
  await anonymizePatient(patientId);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients`);
}
