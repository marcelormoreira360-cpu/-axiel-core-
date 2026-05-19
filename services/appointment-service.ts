import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
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
  const appt = data as Appointment;

  // Fire-and-forget: create Zoom meeting + Google Calendar event
  createIntegrationsSideEffects(appt).catch(() => {});

  return appt;
}

async function createIntegrationsSideEffects(appt: Appointment) {
  const { createZoomMeeting } = await import("@/services/zoom-service");
  const { createGoogleCalendarEvent } = await import("@/services/google-calendar-service");

  const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;
  const sessionType = Array.isArray(appt.session_types) ? appt.session_types[0] : appt.session_types;
  const summary = `${sessionType?.name ?? "Consulta"} — ${patient?.full_name ?? "Paciente"}`;

  const [zoom, googleEventId] = await Promise.allSettled([
    createZoomMeeting(appt.clinic_id, {
      topic:           summary,
      startIso:        appt.starts_at,
      durationMinutes: appt.duration_minutes,
    }),
    createGoogleCalendarEvent(appt.clinic_id, {
      summary,
      startIso:        appt.starts_at,
      durationMinutes: appt.duration_minutes,
      attendeeEmail:   patient?.email ?? null,
    }),
  ]);

  const updates: Record<string, string | null> = {};
  if (zoom.status === "fulfilled" && zoom.value) {
    updates.zoom_meeting_id = zoom.value.meeting_id;
    updates.zoom_join_url   = zoom.value.join_url;
    updates.zoom_start_url  = zoom.value.start_url;
  }
  if (googleEventId.status === "fulfilled" && googleEventId.value) {
    updates.google_event_id = googleEventId.value;
  }

  if (Object.keys(updates).length > 0) {
    const supabase = createSupabaseAdminClient();
    await supabase.from("appointments").update(updates).eq("id", appt.id);
  }
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
