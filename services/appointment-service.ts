import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Appointment, AppointmentSource, SessionType } from "@/lib/types";

export async function getSessionTypes(clinicId?: string): Promise<SessionType[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("session_types")
    .select("*")
    .eq("is_active", true)
    .order("duration_minutes", { ascending: true });

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data } = await query;
  return data ?? [];
}

export async function getAppointments(clinicId?: string): Promise<Appointment[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status)")
    .order("starts_at", { ascending: true });

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Appointment[];
}

export async function createAppointment(input: {
  clinic_id: string;
  patient_id: string;
  starts_at: string;
  duration_minutes: number;
  session_type_id?: string | null;
  source?: AppointmentSource | null;
  patient_offer_id?: string | null;
  notes?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...input, created_by: user?.id ?? null })
    .select("*, patients(id, full_name, email, phone, status), session_types(id, name, duration_minutes, price_cents)")
    .single();

  if (error) throw error;
  return data as Appointment;
}

export async function getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status)")
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Appointment[];
}

export async function getAppointmentById(appointmentId: string): Promise<Appointment | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as Appointment | null;
}
