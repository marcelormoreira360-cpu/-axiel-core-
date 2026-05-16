import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PatientPackage = {
  id: string;
  patient_id: string;
  clinic_id: string;
  name: string;
  sessions_total: number;
  start_date: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  sessions_used: number;
};

export async function getPatientPackages(patientId: string): Promise<PatientPackage[]> {
  const supabase = await createSupabaseServerClient();

  const { data: packages, error } = await supabase
    .from("patient_packages")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error || !packages) return [];

  // Count sessions used: appointments on or after package start_date
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
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from("patient_packages").insert(data);
}

export async function deactivatePatientPackage(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from("patient_packages").update({ is_active: false }).eq("id", id);
}

export async function deletePatientPackage(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from("patient_packages").delete().eq("id", id);
}
