"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentClinic } from "@/services/clinic-service";
import { createPatient } from "@/services/patient-service";
import { createPatientPortalLink } from "@/services/patient-portal-service";
import { sendPatientWelcome } from "@/services/patient-welcome-service";
import { getBillingContext } from "@/services/billing-service";
import { checkUsageLimit } from "@/modules/billing/feature-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const PatientSchema = z.object({
  first_name:   z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
  last_name:    z.string().max(100).optional(),
  email:        z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone:        z.string().max(30).optional(),
  country_code: z.string().max(10).optional(),
  notes:        z.string().max(2000).optional(),
  address_line: z.string().max(200).optional(),
  city:         z.string().max(100).optional(),
  state:        z.string().max(100).optional(),
  zip_code:     z.string().max(20).optional(),
  country:      z.string().max(100).optional(),
});

export async function createPatientAction(formData: FormData) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No clinic available for this user.");

  // ── Validate input ────────────────────────────────────────────────────────
  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
  );
  const parsed = PatientSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Dados inválidos.";
    redirect(`/patients/new?error=${encodeURIComponent(msg)}`);
  }
  const data = parsed.data;

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

  const firstName = data.first_name;
  const lastName  = data.last_name ?? "";
  const fullName  = [firstName, lastName].filter(Boolean).join(" ") || firstName;

  const phone       = data.phone ?? "";
  const countryCode = data.country_code ?? "";
  const fullPhone   = phone ? `${countryCode} ${phone}`.trim() : null;

  const patient = await createPatient({
    clinic_id:    clinic.id,
    full_name:    fullName,
    first_name:   firstName || null,
    last_name:    lastName  || null,
    email:        data.email  || null,
    phone:        fullPhone,
    notes:        data.notes        || null,
    address_line: data.address_line || null,
    city:         data.city         || null,
    state:        data.state        || null,
    zip_code:     data.zip_code     || null,
    country:      data.country      || "Brasil",
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
