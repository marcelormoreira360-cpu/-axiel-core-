import type { MonetizationOffer, MonetizationOfferType, PatientOffer, PatientOfferStatus } from "@/lib/types";

const PATIENT_OFFER_SELECT = "*, patients(id, full_name, email, phone, status), monetization_offers(id, name, offer_type, price_cents, currency, number_of_sessions)";

export async function getMonetizationOffers(clinicId?: string): Promise<MonetizationOffer[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("monetization_offers").select("*").order("created_at", { ascending: false });

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MonetizationOffer[];
}

export async function getActiveMonetizationOffers(): Promise<MonetizationOffer[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("monetization_offers")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MonetizationOffer[];
}

export async function createMonetizationOffer(input: {
  clinic_id: string;
  name: string;
  offer_type: MonetizationOfferType;
  price_cents: number;
  currency?: string;
  number_of_sessions: number;
  description?: string | null;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("monetization_offers")
    .insert({ ...input, currency: input.currency ?? "USD", created_by: user?.id ?? null })
    .select("*")
    .single();

  if (error) throw error;
  return data as MonetizationOffer;
}

export async function updateMonetizationOfferStatus(id: string, isActive: boolean) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("monetization_offers")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as MonetizationOffer;
}

export async function getPatientOffers(patientId?: string): Promise<PatientOffer[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("patient_offers").select(PATIENT_OFFER_SELECT).order("created_at", { ascending: false });

  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PatientOffer[];
}

export async function assignOfferToPatient(input: {
  clinic_id: string;
  patient_id: string;
  offer_id: string;
  sessions_total: number;
  starts_at?: string;
  ends_at?: string | null;
  notes?: string | null;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patient_offers")
    .insert({ ...input, created_by: user?.id ?? null })
    .select(PATIENT_OFFER_SELECT)
    .single();

  if (error) throw error;
  return data as PatientOffer;
}

export async function updatePatientOfferStatus(id: string, status: PatientOfferStatus) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_offers")
    .update({ status })
    .eq("id", id)
    .select(PATIENT_OFFER_SELECT)
    .single();

  if (error) throw error;
  return data as PatientOffer;
}
