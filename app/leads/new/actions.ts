"use server";

import { redirect } from "next/navigation";
import { getCurrentClinic } from "@/services/clinic-service";
import { createLead } from "@/services/lead-service";
import type { LeadSource } from "@/lib/types";

export async function createLeadAction(formData: FormData) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No clinic available for this user.");

  const lead = await createLead({
    clinic_id: clinic.id,
    full_name: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    source: (String(formData.get("source") ?? "other") || "other") as LeadSource,
    stage: "new_lead",
    main_complaint: String(formData.get("main_complaint") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  redirect(`/leads/${lead.id}`);
}
