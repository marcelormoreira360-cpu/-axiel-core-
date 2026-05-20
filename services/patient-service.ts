import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Patient } from "@/lib/types";

export async function getPatients(clinicId?: string, practitionerId?: string): Promise<Patient[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("patients").select("*").order("created_at", { ascending: false });

  if (clinicId) query = query.eq("clinic_id", clinicId);
  if (practitionerId) query = query.eq("created_by", practitionerId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createPatient(input: Pick<Patient, "clinic_id" | "full_name" | "email" | "phone" | "notes">) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patients")
    .insert({ ...input, created_by: user?.id ?? null })
    .select("*")
    .single();

  if (error) throw error;
  return data as Patient;
}

export async function updatePatient(
  patientId: string,
  input: Partial<Pick<Patient, "full_name" | "email" | "phone" | "date_of_birth" | "notes" | "status">>
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("patients").update(input).eq("id", patientId);
  if (error) throw error;
}

export async function getPatientById(patientId: string): Promise<Patient | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("patients").select("*").eq("id", patientId).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Patient;
}
