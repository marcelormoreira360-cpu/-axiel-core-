import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SessionRecord } from "@/lib/types";

export async function getSessionRecordByAppointment(appointmentId: string): Promise<SessionRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_records")
    .select("*, appointments(id, starts_at, duration_minutes, notes), patients(id, full_name, email, phone, status)")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as SessionRecord | null;
}

export async function upsertSessionRecord(input: {
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  notes?: string | null;
  key_observations?: string[];
}): Promise<SessionRecord> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cleanObservations = (input.key_observations ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  const { data, error } = await supabase
    .from("session_records")
    .upsert(
      {
        clinic_id: input.clinic_id,
        appointment_id: input.appointment_id,
        patient_id: input.patient_id,
        notes: input.notes ?? null,
        key_observations: cleanObservations,
        created_by: user?.id ?? null,
      },
      { onConflict: "appointment_id" },
    )
    .select("*, appointments(id, starts_at, duration_minutes, notes), patients(id, full_name, email, phone, status)")
    .single();

  if (error) throw error;
  return data as SessionRecord;
}

export async function getSessionRecordsByPatient(patientId: string): Promise<SessionRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_records")
    .select("*, appointments(id, starts_at, duration_minutes, notes), patients(id, full_name, email, phone, status)")
    .eq("patient_id", patientId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SessionRecord[];
}
