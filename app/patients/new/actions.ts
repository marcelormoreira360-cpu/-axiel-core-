"use server";

import { redirect } from "next/navigation";
import { getClinicsForUser } from "@/services/clinic-service";
import { createPatient } from "@/services/patient-service";

export async function createPatientAction(formData: FormData) {
  const clinics = await getClinicsForUser();
  const clinic = clinics[0];
  if (!clinic) throw new Error("No clinic available for this user.");

  const patient = await createPatient({
    clinic_id: clinic.id,
    full_name: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  redirect(`/patients/${patient.id}`);
}
