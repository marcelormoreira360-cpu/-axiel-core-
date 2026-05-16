"use server";

import { redirect } from "next/navigation";
import { convertLeadToPatient } from "@/services/lead-service";

export async function convertLeadToPatientAction(formData: FormData) {
  const leadId = String(formData.get("lead_id") ?? "").trim();
  if (!leadId) throw new Error("Lead is required.");

  const patient = await convertLeadToPatient(leadId);
  redirect(`/patients/${patient.id}`);
}
