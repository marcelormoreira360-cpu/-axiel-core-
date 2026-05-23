"use server";

import { redirect } from "next/navigation";
import { getClinicsForUser } from "@/services/clinic-service";
import { createPatient } from "@/services/patient-service";
import { createPatientPortalLink } from "@/services/patient-portal-service";
import { sendPatientWelcome } from "@/services/patient-welcome-service";

export async function createPatientAction(formData: FormData) {
  const clinics = await getClinicsForUser();
  const clinic = clinics[0];
  if (!clinic) throw new Error("No clinic available for this user.");

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
