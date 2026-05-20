import type { Lead, LeadStage, Patient } from "@/lib/types";
import { writeAuditLog } from "@/services/audit-service";
import { auditEvents } from "@/modules/security/audit-events";

export async function getLeads(clinicId?: string): Promise<Lead[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as Lead;
}

export async function createLead(input: Pick<Lead, "clinic_id" | "full_name" | "email" | "phone" | "source" | "stage" | "main_complaint" | "notes">) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("leads")
    .insert({ ...input, created_by: user?.id ?? null })
    .select("*")
    .single();

  if (error) throw error;
  return data as Lead;
}

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("leads").update({ stage }).eq("id", leadId).select("*").single();

  if (error) throw error;
  return data as Lead;
}


function buildConvertedLeadNotes(lead: Lead) {
  const lines = [
    "Created from converted lead.",
    `Lead source: ${lead.source}`,
    lead.main_complaint ? `Main complaint: ${lead.main_complaint}` : null,
    lead.notes ? `Lead notes: ${lead.notes}` : null,
  ].filter(Boolean);

  return lines.join("\n\n");
}

export async function convertLeadToPatient(leadId: string): Promise<Patient> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leadData, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError) throw leadError;

  const lead = leadData as Lead;

  if (lead.converted_patient_id) {
    const { data: existingPatient, error: existingPatientError } = await supabase
      .from("patients")
      .select("*")
      .eq("id", lead.converted_patient_id)
      .single();

    if (existingPatientError) throw existingPatientError;
    return existingPatient as Patient;
  }

  const { data: patientData, error: patientError } = await supabase
    .from("patients")
    .insert({
      clinic_id: lead.clinic_id,
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      status: "active",
      notes: buildConvertedLeadNotes(lead),
      created_by: user?.id ?? lead.created_by ?? null,
    })
    .select("*")
    .single();

  if (patientError) throw patientError;

  const patient = patientData as Patient;

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      stage: "converted_to_patient",
      converted_patient_id: patient.id,
    })
    .eq("id", lead.id);

  if (updateError) throw updateError;

  await writeAuditLog({
    clinicId: lead.clinic_id,
    action: auditEvents.leadConverted,
    entityType: "lead",
    entityId: lead.id,
    metadata: {
      patient_id: patient.id,
      lead_source: lead.source,
    },
  });

  return patient;
}
