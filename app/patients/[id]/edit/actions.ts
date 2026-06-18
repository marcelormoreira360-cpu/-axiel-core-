"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updatePatient, anonymizePatient } from "@/services/patient-service";

export async function updatePatientAction(patientId: string, formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const cpf = String(formData.get("cpf") ?? "").replace(/\D/g, "") || null;
  const date_of_birth = String(formData.get("date_of_birth") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active") as "active" | "inactive" | "archived";
  const referred_by_patient_id = String(formData.get("referred_by_patient_id") ?? "").trim() || null;
  const sex = String(formData.get("sex") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const weightRaw = String(formData.get("weight_kg") ?? "").trim().replace(",", ".");
  const heightRaw = String(formData.get("height_cm") ?? "").trim().replace(",", ".");
  const weight_kg = weightRaw && Number.isFinite(Number(weightRaw)) ? Number(weightRaw) : null;
  const height_cm = heightRaw && Number.isFinite(Number(heightRaw)) ? Number(heightRaw) : null;

  if (!full_name) return;

  await updatePatient(patientId, { full_name, email, phone, cpf, date_of_birth, sex, weight_kg, height_cm, city, notes, status, referred_by_patient_id });

  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

export async function anonymizePatientAction(patientId: string): Promise<void> {
  "use server";
  await anonymizePatient(patientId);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients`);
}
