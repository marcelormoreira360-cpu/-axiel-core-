import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface LeadStageCounts {
  new_lead: number;
  contacted: number;
  scheduled: number;
  converted_to_patient: number;
  total: number;
}

export interface PatientCounts {
  active: number;
  newThisMonth: number;
  total: number;
}

export async function getLeadStageCounts(clinicId: string): Promise<LeadStageCounts> {
  const supabase = await createSupabaseServerClient();

  const stages = ["new_lead", "contacted", "scheduled", "converted_to_patient"] as const;
  const results = await Promise.all(
    stages.map((stage) =>
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("stage", stage)
    )
  );

  const [new_lead, contacted, scheduled, converted_to_patient] = results.map(
    (r) => r.count ?? 0
  );
  const total = new_lead + contacted + scheduled + converted_to_patient;

  return { new_lead, contacted, scheduled, converted_to_patient, total };
}

export async function getPatientCounts(clinicId: string): Promise<PatientCounts> {
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [activeResult, newThisMonthResult, totalResult] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "active"),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", monthStart),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
  ]);

  return {
    active: activeResult.count ?? 0,
    newThisMonth: newThisMonthResult.count ?? 0,
    total: totalResult.count ?? 0,
  };
}
