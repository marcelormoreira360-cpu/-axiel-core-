"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertSessionRecord } from "@/services/session-recording-service";

export async function saveSessionRecord(formData: FormData) {
  const appointmentId = String(formData.get("appointment_id") ?? "");
  const patientId     = String(formData.get("patient_id") ?? "");
  const clinicId      = String(formData.get("clinic_id") ?? "");
  const notes         = String(formData.get("notes") ?? "").trim();
  const observationsRaw = String(formData.get("key_observations") ?? "[]");
  const soapMode      = formData.get("soap_mode") === "1";
  const subjective    = String(formData.get("subjective") ?? "").trim() || null;
  const objective     = String(formData.get("objective") ?? "").trim() || null;
  const assessmentNote = String(formData.get("assessment_note") ?? "").trim() || null;
  const plan          = String(formData.get("plan") ?? "").trim() || null;

  let keyObservations: string[] = [];
  try {
    const parsed = JSON.parse(observationsRaw);
    if (Array.isArray(parsed)) {
      keyObservations = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    keyObservations = [];
  }

  if (!appointmentId || !patientId || !clinicId) {
    throw new Error("Missing session information.");
  }

  await upsertSessionRecord({
    appointment_id:  appointmentId,
    patient_id:      patientId,
    clinic_id:       clinicId,
    notes,
    key_observations: keyObservations,
    soap_mode:       soapMode,
    subjective,
    objective,
    assessment_note: assessmentNote,
    plan,
  });

  revalidatePath(`/schedule/${appointmentId}/session`);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/prontuario`);
  redirect(`/schedule/${appointmentId}/session?saved=1`);
}
