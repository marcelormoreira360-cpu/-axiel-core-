import type { SessionRecord } from "@/lib/types";

const SESSION_SELECT =
  "*, appointments(id, starts_at, duration_minutes, notes), patients(id, full_name, email, phone, status)";

export async function getSessionRecordByAppointment(appointmentId: string): Promise<SessionRecord | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_records")
    .select(SESSION_SELECT)
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
  soap_mode?: boolean;
  subjective?: string | null;
  objective?: string | null;
  assessment_note?: string | null;
  plan?: string | null;
}): Promise<SessionRecord> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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
        clinic_id:        input.clinic_id,
        appointment_id:   input.appointment_id,
        patient_id:       input.patient_id,
        notes:            input.notes ?? null,
        key_observations: cleanObservations,
        soap_mode:        input.soap_mode ?? false,
        subjective:       input.subjective ?? null,
        objective:        input.objective ?? null,
        assessment_note:  input.assessment_note ?? null,
        plan:             input.plan ?? null,
        created_by:       user?.id ?? null,
      },
      { onConflict: "appointment_id" },
    )
    .select(SESSION_SELECT)
    .single();

  if (error) throw error;
  return data as SessionRecord;
}

export async function getSessionRecordsByPatient(patientId: string): Promise<SessionRecord[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_records")
    .select(SESSION_SELECT)
    .eq("patient_id", patientId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SessionRecord[];
}
