import type { Patient } from "@/lib/types";

export async function getPatients(
  clinicId?: string,
  practitionerId?: string,
  limit = 500,
  offset = 0,
  search?: string,
): Promise<Patient[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("patients")
    .select("*, appointments(practitioner_id)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (clinicId) query = query.eq("clinic_id", clinicId);
  if (practitionerId) query = query.eq("created_by", practitionerId);

  // Server-side search across name, email, and phone (case-insensitive prefix/infix match)
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getPatientCount(
  clinicId?: string,
  practitionerId?: string,
  search?: string,
): Promise<number> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("patients")
    .select("id", { count: "exact", head: true });

  if (clinicId) query = query.eq("clinic_id", clinicId);
  if (practitionerId) query = query.eq("created_by", practitionerId);

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function createPatient(input: Pick<Patient, "clinic_id" | "full_name" | "email" | "phone" | "notes"> & {
  first_name?: string | null;
  last_name?: string | null;
  cpf?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  country?: string | null;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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
  input: Partial<Pick<Patient, "full_name" | "email" | "phone" | "cpf" | "date_of_birth" | "notes" | "status">>
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  // Resolve the caller's clinic so the UPDATE is always scoped —
  // prevents any authenticated user from editing patients of other clinics.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) throw new Error("Usuário sem clínica associada.");

  const { error } = await supabase
    .from("patients")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id); // ← scope: only own clinic

  if (error) throw error;
}

export async function getPatientById(
  patientId: string,
  clinicId?: string,
): Promise<Patient | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("patients")
    .select("*")
    .eq("id", patientId);

  // When clinicId is supplied, scope the read explicitly.
  // Falls back to RLS when clinicId is omitted (service-to-service calls).
  if (clinicId) {
    query = query.eq("clinic_id", clinicId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as Patient | null;
}

// ── LGPD: anonimização de dados do paciente ───────────────────────────────────
// Ao invés de apagar o prontuário (útil para histórico clínico),
// substituímos todos os PII por valores genéricos e desativamos o paciente.
export async function anonymizePatient(patientId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) throw new Error("Clínica não encontrada.");
  // Only admins and owners may delete patient PII
  if (!["admin", "owner", "platform_admin"].includes(profile.role)) {
    throw new Error("Permissão insuficiente para anonimizar paciente.");
  }

  const { error } = await supabase
    .from("patients")
    .update({
      full_name:     "Paciente Anonimizado",
      email:         null,
      phone:         null,
      date_of_birth: null,
      address_line:  null,
      city:          null,
      state:         null,
      zip_code:      null,
      country:       null,
      notes:         null,
      status:        "inactive",
      updated_at:    new Date().toISOString(),
    })
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id);

  if (error) throw error;
}
