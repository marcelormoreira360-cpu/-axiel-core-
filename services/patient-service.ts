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
    .is("deleted_at", null) // não lista pacientes arquivados/soft-deleted
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

// Versão leve da listagem: só as colunas que as telas de lista usam.
// getPatients() com select(*) arrasta assessment_data/anamnese/notes (JSONB e
// textos longos) — MBs de payload RSC em /patients, /schedule e /financeiro.
export type PatientLite = Pick<
  Patient,
  "id" | "clinic_id" | "full_name" | "email" | "phone" | "status" | "created_at"
> & { appointments?: { practitioner_id: string | null }[] };

export async function getPatientsLite(
  clinicId?: string,
  practitionerId?: string,
  limit = 500,
  offset = 0,
  search?: string,
): Promise<PatientLite[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("patients")
    .select("id, clinic_id, full_name, email, phone, status, created_at, appointments(practitioner_id)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (clinicId) query = query.eq("clinic_id", clinicId);
  if (practitionerId) query = query.eq("created_by", practitionerId);

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PatientLite[];
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
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null); // espelha o filtro de getPatients (contagem = lista)

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
  date_of_birth?: string | null;
  sex?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  address_line?: string | null;
  neighborhood?: string | null;
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

/**
 * Agendamento: acha um paciente já existente na clínica ANTES de criar, para não
 * duplicar quando o terapeuta reusa o mesmo paciente. Dedup por e-mail (mais forte)
 * → telefone → nome exato (case-insensitive). No nome, só reusa quando há UM único
 * match (evita fundir homônimos). Enriquece contato vazio do existente sem sobrescrever.
 */
export async function findOrCreatePatientForBooking(input: {
  clinic_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<Patient> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const name = input.full_name.trim();
  const email = input.email?.trim().toLowerCase() || null;
  const phoneRaw = input.phone?.trim() || null;
  const { normalizePhoneDigits } = await import("@/lib/phone");
  const phoneDigits = normalizePhoneDigits(phoneRaw);

  let existing: Patient | null = null;
  if (email) {
    const { data } = await supabase.from("patients").select("*")
      .eq("clinic_id", input.clinic_id).eq("email", email).is("deleted_at", null).limit(1).maybeSingle();
    existing = (data as Patient) ?? null;
  }
  if (!existing && phoneDigits) {
    const phones = [...new Set([phoneDigits, phoneRaw].filter(Boolean) as string[])];
    const { data } = await supabase.from("patients").select("*")
      .eq("clinic_id", input.clinic_id).in("phone", phones).is("deleted_at", null).limit(1).maybeSingle();
    existing = (data as Patient) ?? null;
  }
  if (!existing && name) {
    // ilike sem curinga = igualdade case-insensitive; escapa %/_ por segurança.
    const safe = name.replace(/[%_]/g, "\\$&");
    const { data } = await supabase.from("patients").select("*")
      .eq("clinic_id", input.clinic_id).ilike("full_name", safe).is("deleted_at", null).limit(2);
    if (data && data.length === 1) existing = data[0] as Patient;
  }

  if (existing) {
    const patch: Record<string, string> = {};
    if (email && !existing.email) patch.email = email;
    if (phoneDigits && !existing.phone) patch.phone = phoneDigits;
    if (Object.keys(patch).length > 0) {
      await supabase.from("patients").update(patch).eq("id", existing.id).eq("clinic_id", input.clinic_id);
      return { ...existing, ...patch } as Patient;
    }
    return existing;
  }

  return createPatient({ clinic_id: input.clinic_id, full_name: name, email, phone: phoneDigits ?? phoneRaw, notes: null });
}

export async function updatePatient(
  patientId: string,
  input: Partial<Pick<Patient, "full_name" | "email" | "phone" | "cpf" | "locale" | "date_of_birth" | "sex" | "weight_kg" | "height_cm" | "notes" | "status" | "chief_complaint" | "case_summary" | "anamnese" | "antecedents" | "pain_level" | "pain_location" | "treatment_note" | "assessment_data" | "address_line" | "neighborhood" | "city" | "state" | "zip_code" | "country" | "referred_by_patient_id">>
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

// ── Indicação paciente→paciente (quick win #4) ────────────────────────────────
export type PatientPickerItem = { id: string; full_name: string };

/** Lista enxuta de pacientes da clínica para o seletor "indicado por". */
export async function getClinicPatientsForPicker(
  clinicId: string,
  excludeId?: string,
): Promise<PatientPickerItem[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PatientPickerItem[];
}

export type PatientReferralInfo = {
  referredByName: string | null;
  referred: PatientPickerItem[];
};

/** Quem indicou este paciente + quantos/quais pacientes ele trouxe. */
export async function getPatientReferralInfo(
  patientId: string,
  clinicId: string,
  referredById?: string | null,
): Promise<PatientReferralInfo> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const [referredRes, referrerRes] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("referred_by_patient_id", patientId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    referredById
      ? supabase.from("patients").select("full_name").eq("id", referredById).eq("clinic_id", clinicId).maybeSingle()
      : Promise.resolve({ data: null as { full_name?: string } | null }),
  ]);

  if (referredRes.error) throw referredRes.error;
  return {
    referredByName: (referrerRes.data as { full_name?: string } | null)?.full_name ?? null,
    referred: (referredRes.data ?? []) as PatientPickerItem[],
  };
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
      neighborhood:  null,
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
