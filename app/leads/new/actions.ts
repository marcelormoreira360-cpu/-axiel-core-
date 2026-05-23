"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentClinic } from "@/services/clinic-service";
import { createLead } from "@/services/lead-service";

const LEAD_SOURCES = ["instagram", "google", "facebook", "website", "referral", "other"] as const;

const LeadSchema = z.object({
  full_name:      z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(200),
  email:          z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone:          z.string().max(30).optional(),
  source:         z.enum(LEAD_SOURCES).default("other"),
  main_complaint: z.string().max(500).optional(),
  notes:          z.string().max(2000).optional(),
});

export async function createLeadAction(formData: FormData) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No clinic available for this user.");

  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
  );
  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Dados inválidos.";
    redirect(`/leads/new?error=${encodeURIComponent(msg)}`);
  }
  const data = parsed.data;

  const lead = await createLead({
    clinic_id:      clinic.id,
    full_name:      data.full_name,
    email:          data.email  || null,
    phone:          data.phone  || null,
    source:         data.source,
    stage:          "new_lead",
    main_complaint: data.main_complaint || null,
    notes:          data.notes          || null,
  });

  redirect(`/leads/${lead.id}`);
}
