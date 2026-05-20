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

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, starts_at")
    .eq("patient_id", patientId);

  return packages.map((pkg) => {
    const used = (appointments ?? []).filter(
      (a) => new Date(a.starts_at) >= new Date(pkg.start_date + "T00:00:00")
    ).length;
    return { ...pkg, sessions_used: used };
  });
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

export async function deactivatePatientPackage(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  await supabase.from("patient_packages").update({ is_active: false }).eq("id", id);
}

export async function deletePatientPackage(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  await supabase.from("patient_packages").delete().eq("id", id);
}

// Called after each appointment is created. Checks active packages with auto_renew=true
// and renews any that are now complete (sessions_used >= sessions_total).
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

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, starts_at")
    .eq("patient_id", patientId);

  const apptDate = new Date(appointmentStartsAt);

  for (const pkg of packages) {
    const used = (appointments ?? []).filter(
      (a) => new Date(a.starts_at) >= new Date(pkg.start_date + "T00:00:00")
    ).length;

    if (used >= pkg.sessions_total) {
      // Deactivate current package and create renewed one
      await supabase
        .from("patient_packages")
        .update({ is_active: false })
        .eq("id", pkg.id);

      const newStartDate = apptDate.toISOString().split("T")[0];

      await supabase.from("patient_packages").insert({
        patient_id: pkg.patient_id,
        clinic_id:  pkg.clinic_id,
        name:       pkg.name,
        sessions_total: pkg.sessions_total,
        start_date: newStartDate,
        notes:      pkg.notes,
        auto_renew: true,
        is_active:  true,
      });
    }
  }
}
