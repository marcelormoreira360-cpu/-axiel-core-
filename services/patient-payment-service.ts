import type { PatientPayment, PaymentMethod } from "@/lib/types";

export async function getPatientPayments(patientId: string): Promise<PatientPayment[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_payments")
    .select("*")
    .eq("patient_id", patientId)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PatientPayment[];
}

export async function getClinicPayments(clinicId: string, from?: string, to?: string): Promise<PatientPayment[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("patient_payments")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("paid_at", { ascending: false });
  if (from) query = query.gte("paid_at", from);
  if (to)   query = query.lte("paid_at", to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PatientPayment[];
}

export async function createPatientPayment(input: {
  clinic_id: string;
  patient_id: string;
  appointment_id?: string | null;
  patient_offer_id?: string | null;
  amount_cents: number;
  currency?: string;
  payment_method?: PaymentMethod | null;
  paid_at?: string;
  notes?: string | null;
}): Promise<PatientPayment> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patient_payments")
    .insert({
      ...input,
      currency: input.currency ?? "BRL",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PatientPayment;
}
