import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PatientPackage = {
  id: string;
  patient_id: string;
  clinic_id: string;
  name: string;
  sessions_total: number;
  start_date: string;
  notes: string | null;
  is_active: boolean;
  auto_renew: boolean;
  created_at: string;
  // Kept in sync by trigger 012_fix_sessions_used (no longer calculated in memory)
  sessions_used: number;
};

export async function getPatientPackages(patientId: string): Promise<PatientPackage[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data: packages, error } = await supabase
    .from("patient_packages")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error || !packages) return [];

  // sessions_used is now kept accurate by a DB trigger (migration 012).
  // No in-memory recalculation needed.
  return packages as PatientPackage[];
}

export async function createPatientPackage(data: {
  patient_id: string;
  clinic_id: string;
  name: string;
  sessions_total: number;
  start_date: string;
  notes?: string;
  auto_renew?: boolean;
}): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  await supabase.from("patient_packages").insert(data);
}

export async function deactivatePatientPackage(id: string, clinicId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  // A-01: scope to clinicId to prevent IDOR across clinics
  await supabase.from("patient_packages").update({ is_active: false }).eq("id", id).eq("clinic_id", clinicId);
}

export async function deletePatientPackage(id: string, clinicId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  // A-01: scope to clinicId to prevent IDOR across clinics
  await supabase.from("patient_packages").delete().eq("id", id).eq("clinic_id", clinicId);
}

// Called after each appointment is created/updated. Checks active packages with
// auto_renew=true and renews any that are now complete (sessions_used >= sessions_total).
// sessions_used is already kept accurate by the DB trigger — no recalculation needed.
export async function checkAndAutoRenewPackages(
  patientId: string,
  clinicId: string,
  appointmentStartsAt: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: packages } = await supabase
    .from("patient_packages")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .eq("auto_renew", true);

  if (!packages || packages.length === 0) return;

  const apptDate = new Date(appointmentStartsAt);

  for (const pkg of packages) {
    // sessions_used is accurate thanks to the DB trigger
    if ((pkg.sessions_used ?? 0) >= pkg.sessions_total) {
      await supabase
        .from("patient_packages")
        .update({ is_active: false })
        .eq("id", pkg.id);

      const newStartDate = apptDate.toISOString().split("T")[0];

      await supabase.from("patient_packages").insert({
        patient_id:     pkg.patient_id,
        clinic_id:      pkg.clinic_id,
        name:           pkg.name,
        sessions_total: pkg.sessions_total,
        start_date:     newStartDate,
        notes:          pkg.notes,
        auto_renew:     true,
        is_active:      true,
      });
    }
  }
}
