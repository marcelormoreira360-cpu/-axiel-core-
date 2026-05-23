"use server";

import { redirect } from "next/navigation";
import { getCurrentClinic } from "@/services/clinic-service";
import { createPatient } from "@/services/patient-service";
import { createPatientPortalLink } from "@/services/patient-portal-service";
import { sendPatientWelcome } from "@/services/patient-welcome-service";
import { getBillingContext } from "@/services/billing-service";
import { checkUsageLimit } from "@/modules/billing/feature-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function createPatientAction(formData: FormData) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No clinic available for this user.");

  // ── Usage gate: patients limit ────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinic.id);
  const billingCtx = await getBillingContext(clinic.id, { patients: count ?? 0 });
  const patientsCheck = checkUsageLimit(billingCtx, "patients");
  if (patientsCheck.isAtLimit) {
    redirect(`/patients/new?error=${encodeURIComponent(`Limite de ${patientsCheck.limit} pacientes atingido. Faça upgrade para adicionar mais.`)}`);
  }

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName  = String(formData.get("last_name")  ?? "").trim();
  const fullName  = [firstName, lastName].filter(Boolean).join(" ") || firstName;

  const phone       = String(formData.get("phone")        ?? "").trim();
  const countryCode = String(formData.get("country_code") ?? "").trim();
  const fullPhone   = phone ? `${countryCode} ${phone}` : null;

  const patient = await createPatient({
    clinic_id:    clinic.id,
    full_name:    fullName,
    first_name:   firstName || null,
    last_name:    lastName  || null,
    email:        String(formData.get("email")        ?? "").trim() || null,
    phone:        fullPhone,
    notes:        String(formData.get("notes")        ?? "").trim() || null,
    address_line: String(formData.get("address_line") ?? "").trim() || null,
    city:         String(formData.get("city")         ?? "").trim() || null,
    state:        String(formData.get("state")        ?? "").trim() || null,
    zip_code:     String(formData.get("zip_code")     ?? "").trim() || null,
    country:      String(formData.get("country")      ?? "").trim() || "Brasil",
  });

  // Fire-and-forget: create portal link and send welcome message
  if (patient.email || patient.phone) {
    createPatientPortalLink(patient.id)
      .then(({ token }) => sendPatientWelcome(patient, token))
      .catch(() => sendPatientWelcome(patient))
      .catch(() => {});
  }

  redirect(`/patients/${patient.id}`);
}
