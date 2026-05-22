import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Appointment, AppointmentSource, SessionType } from "@/lib/types";

export async function getSessionTypes(clinicId?: string): Promise<SessionType[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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

export async function getAppointments(clinicId?: string, practitionerId?: string): Promise<Appointment[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status)")
    .order("starts_at", { ascending: true });

  if (clinicId) query = query.eq("clinic_id", clinicId);
  if (practitionerId) query = query.eq("created_by", practitionerId);

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
  video_url?: string | null;
  practitioner_id?: string | null;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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

  // Fire-and-forget: integrations + package auto-renewal + booking confirmation
  createIntegrationsSideEffects(appt).catch(() => {});
  import("@/services/package-service").then(({ checkAndAutoRenewPackages }) =>
    checkAndAutoRenewPackages(appt.patient_id, appt.clinic_id, appt.starts_at).catch(() => {})
  );
  sendConfirmationSideEffect(appt).catch(() => {});
  import("@/services/automation-service").then(({ scheduleAutomations }) =>
    scheduleAutomations({ id: appt.id, clinic_id: appt.clinic_id, patient_id: appt.patient_id, starts_at: appt.starts_at }).catch(() => {})
  );

  return appt;
}

async function createIntegrationsSideEffects(appt: Appointment) {
  const { createZoomMeeting } = await import("@/services/zoom-service");
  const { createGoogleCalendarEvent } = await import("@/services/google-calendar-service");

  const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;
  const sessionType = Array.isArray(appt.session_types) ? appt.session_types[0] : appt.session_types;
  const summary = `${sessionType?.name ?? "Consulta"} — ${patient?.full_name ?? "Paciente"}`;

  // Fetch is_online flag for this session type (not included in appointment select)
  let isOnlineSession = false;
  if (appt.session_type_id) {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: st } = await supabaseAdmin
      .from("session_types")
      .select("is_online")
      .eq("id", appt.session_type_id)
      .single();
    isOnlineSession = st?.is_online ?? false;
  }

  const tasks: Promise<unknown>[] = [
    createGoogleCalendarEvent(appt.clinic_id, {
      summary,
      startIso:        appt.starts_at,
      durationMinutes: appt.duration_minutes,
      attendeeEmail:   patient?.email ?? null,
    }),
  ];

  if (isOnlineSession) {
    tasks.push(
      createZoomMeeting(appt.clinic_id, {
        topic:           summary,
        startIso:        appt.starts_at,
        durationMinutes: appt.duration_minutes,
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  const googleEventId = results[0];
  const zoom = isOnlineSession ? results[1] : null;

  const updates: Record<string, string | null> = {};
  if (zoom?.status === "fulfilled" && zoom.value) {
    const zv = zoom.value as { meeting_id: string; join_url: string; start_url: string };
    updates.zoom_meeting_id = zv.meeting_id;
    updates.zoom_join_url   = zv.join_url;
    updates.zoom_start_url  = zv.start_url;
  }
  if (googleEventId.status === "fulfilled" && googleEventId.value) {
    updates.google_event_id = googleEventId.value as string;
  }

  if (Object.keys(updates).length > 0) {
    const supabase = createSupabaseAdminClient();
    await supabase.from("appointments").update(updates).eq("id", appt.id);
  }
}

// ── Update appointment ────────────────────────────────────────────────────────

export async function updateAppointment(
  appointmentId: string,
  updates: {
    starts_at?: string;
    duration_minutes?: number;
    notes?: string | null;
    status?: string;
    video_url?: string | null;
    practitioner_id?: string | null;
  }
): Promise<Appointment> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", appointmentId)
    .select("*, patients(id, full_name, email, phone, status), session_types(id, name, duration_minutes)")
    .single();

  if (error) throw error;
  const appt = data as Appointment;

  // Sync time changes to Google Calendar (non-blocking)
  if ((updates.starts_at || updates.duration_minutes) && appt.google_event_id) {
    const { updateGoogleCalendarEvent } = await import("@/services/google-calendar-service");
    const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;
    const sessionType = Array.isArray(appt.session_types) ? appt.session_types[0] : appt.session_types;
    updateGoogleCalendarEvent(appt.clinic_id, appt.google_event_id, {
      summary: `${sessionType?.name ?? "Consulta"} — ${patient?.full_name ?? "Paciente"}`,
      startIso: appt.starts_at,
      durationMinutes: appt.duration_minutes,
      attendeeEmail: patient?.email ?? null,
    }).catch((err: unknown) => console.error("Google Calendar update failed:", err));
  }

  // Cancel Google Calendar event if appointment is cancelled
  if (updates.status === "cancelled" && appt.google_event_id) {
    const { deleteGoogleCalendarEvent } = await import("@/services/google-calendar-service");
    deleteGoogleCalendarEvent(appt.clinic_id, appt.google_event_id).catch(
      (err: unknown) => console.error("Google Calendar delete failed:", err)
    );
  }

  return appt;
}

export async function getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as Appointment | null;
}

async function sendConfirmationSideEffect(appt: Appointment) {
  const { sendAppointmentConfirmation } = await import("@/services/automation-service");
  const { data: clinic } = await createSupabaseAdminClient()
    .from("clinics").select("name").eq("id", appt.clinic_id).single();
  const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;
  const sessionType = Array.isArray(appt.session_types) ? appt.session_types[0] : appt.session_types;
  if (!patient?.full_name) return;
  await sendAppointmentConfirmation({
    clinicId: appt.clinic_id,
    patientId: appt.patient_id,
    appointmentId: appt.id,
    patientName: patient.full_name,
    patientPhone: patient.phone ?? null,
    patientEmail: patient.email ?? null,
    clinicName: clinic?.name ?? "nossa clínica",
    startsAt: appt.starts_at,
    durationMinutes: appt.duration_minutes,
  });
}
