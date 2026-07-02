import { createHash, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Appointment, AppointmentSource, SessionType } from "@/lib/types";

function hashConfirmToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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

export async function getAppointments(
  clinicId?: string,
  practitionerId?: string,
  /** PERF-03: narrow the time window to avoid loading the full history.
   *  Defaults to 60 days back + 90 days forward. Pass null to load all. */
  windowDays: { past?: number; future?: number } | null = { past: 60, future: 90 },
): Promise<Appointment[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status)")
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });

  if (clinicId) query = query.eq("clinic_id", clinicId);
  if (practitionerId) query = query.eq("created_by", practitionerId);

  if (windowDays !== null) {
    const now = new Date();
    const pastDays = windowDays.past ?? 60;
    const futureDays = windowDays.future ?? 90;
    const from = new Date(now.getTime() - pastDays * 86_400_000).toISOString();
    const to   = new Date(now.getTime() + futureDays * 86_400_000).toISOString();
    query = query.gte("starts_at", from).lte("starts_at", to);
  }

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
  // Questionários automáticos na 1ª sessão (fire-and-forget)
  import("@/services/onboarding-assessment-service").then(({ sendOnboardingAssessments }) =>
    sendOnboardingAssessments({ id: appt.id, clinic_id: appt.clinic_id, patient_id: appt.patient_id }).catch(() => {})
  );

  return appt;
}

// ── Link de confirmação (agendamento pendente + token) ─────────────────────────

/**
 * Cria um agendamento PENDENTE que segura o horário e gera um token de confirmação.
 * NÃO dispara os side-effects de confirmação (Zoom/Google/WhatsApp/questionários) —
 * isso só acontece quando o paciente confirma via `confirmAppointmentByToken`.
 */
export async function createPendingAppointmentWithToken(input: {
  clinic_id: string;
  patient_id: string;
  starts_at: string;
  duration_minutes: number;
  session_type_id?: string | null;
  practitioner_id?: string | null;
  notes?: string | null;
  expiresInDays?: number;
}): Promise<{ appointmentId: string; token: string }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + (input.expiresInDays ?? 7) * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: input.clinic_id,
      patient_id: input.patient_id,
      starts_at: input.starts_at,
      duration_minutes: input.duration_minutes,
      session_type_id: input.session_type_id ?? null,
      practitioner_id: input.practitioner_id ?? null,
      notes: input.notes ?? null,
      source: "direct",
      status: "pending",
      confirm_token_hash: hashConfirmToken(token),
      confirm_expires_at: expires,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("Falha ao criar agendamento pendente.");
  return { appointmentId: data.id, token };
}

export type ConfirmAppointmentInfo = {
  id: string;
  clinic_id: string;
  starts_at: string;
  duration_minutes: number;
  status: string | null;
  expired: boolean;
  clinic: { name: string; logo_url: string | null; primary_color: string | null } | null;
  patient: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  session_type_name: string | null;
};

/** Resolve um agendamento pelo token do link de confirmação (admin client, rota pública). */
export async function getAppointmentByConfirmToken(token: string): Promise<ConfirmAppointmentInfo | null> {
  if (!token) return null;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, clinic_id, starts_at, duration_minutes, status, confirm_expires_at, patients(id, full_name, email, phone), clinics(name, logo_url, primary_color), session_types(name)")
    .eq("confirm_token_hash", hashConfirmToken(token))
    .maybeSingle();
  if (!data) return null;

  const clinic = Array.isArray(data.clinics) ? data.clinics[0] : data.clinics;
  const patient = Array.isArray(data.patients) ? data.patients[0] : data.patients;
  const st = Array.isArray(data.session_types) ? data.session_types[0] : data.session_types;
  const expired = data.confirm_expires_at ? new Date(data.confirm_expires_at as string).getTime() < Date.now() : false;

  return {
    id: data.id,
    clinic_id: data.clinic_id,
    starts_at: data.starts_at,
    duration_minutes: data.duration_minutes,
    status: data.status,
    expired,
    clinic: clinic ? { name: clinic.name, logo_url: clinic.logo_url ?? null, primary_color: clinic.primary_color ?? null } : null,
    patient: patient ? { id: patient.id, full_name: patient.full_name, email: patient.email ?? null, phone: patient.phone ?? null } : null,
    session_type_name: st?.name ?? null,
  };
}

/**
 * Confirma o agendamento: enriquece o paciente com os dados informados, vira
 * status 'confirmed' e limpa o token. Idempotente via `.eq("status","pending")`.
 */
export async function confirmAppointmentByToken(
  token: string,
  patientFields: Partial<{
    full_name: string; email: string | null; phone: string | null; cpf: string | null;
    date_of_birth: string | null; address_line: string | null; neighborhood: string | null;
    city: string | null; state: string | null; zip_code: string | null; country: string | null;
  }>,
): Promise<{ ok: boolean; error?: string; clinicId?: string; patientId?: string; appointmentId?: string; startsAt?: string }> {
  const info = await getAppointmentByConfirmToken(token);
  if (!info) return { ok: false, error: "Link inválido ou expirado." };
  if (info.status !== "pending") return { ok: false, error: "Este agendamento já foi confirmado ou não está mais disponível." };
  if (info.expired) return { ok: false, error: "Este link expirou. Solicite um novo à clínica." };

  const supabase = createSupabaseAdminClient();

  if (info.patient?.id) {
    const cleaned = Object.fromEntries(Object.entries(patientFields).filter(([, v]) => v !== undefined));
    // Erro do update NÃO pode ser silencioso: se os dados do paciente (nome,
    // contato, demografia) não gravarem, a confirmação não deve seguir como se
    // tivesse gravado.
    const { error: pErr } = await supabase
      .from("patients")
      .update({ ...cleaned, status: "active", updated_at: new Date().toISOString() })
      .eq("id", info.patient.id)
      .eq("clinic_id", info.clinic_id);
    if (pErr) return { ok: false, error: "Não foi possível salvar seus dados. Tente novamente." };
  }

  const { data: updated, error } = await supabase
    .from("appointments")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirm_token_hash: null, confirm_expires_at: null })
    .eq("id", info.id)
    .eq("status", "pending")
    .select("id");

  if (error) return { ok: false, error: "Erro ao confirmar o horário. Tente novamente." };
  // 0 linhas = outro submit confirmou primeiro; não rode os side-effects em dobro.
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Este agendamento já foi confirmado ou não está mais disponível." };
  }
  return { ok: true, clinicId: info.clinic_id, patientId: info.patient?.id, appointmentId: info.id, startsAt: info.starts_at };
}

/**
 * Roda as integrações (Google Calendar + Zoom, se a sessão for online) para um
 * agendamento já existente — usado na confirmação por token, já que o agendamento
 * pendente é criado sem disparar esses side-effects.
 */
export async function runIntegrationsForAppointment(appointmentId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status), session_types(id, name, duration_minutes, price_cents)")
    .eq("id", appointmentId)
    .single();
  if (!data) return;
  await createIntegrationsSideEffects(data as Appointment);
}

async function createIntegrationsSideEffects(appt: Appointment) {
  const { createZoomMeeting } = await import("@/services/zoom-service");
  const { createGoogleCalendarEvent } = await import("@/services/google-calendar-service");

  const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;
  const sessionType = Array.isArray(appt.session_types) ? appt.session_types[0] : appt.session_types;
  const summary = `${sessionType?.name ?? "Consulta"} — ${patient?.full_name ?? "Paciente"}`;

  // Fetch is_online + is_recorded flags for this session type
  let isOnlineSession = false;
  let isRecordedSession = true; // default: record if online
  if (appt.session_type_id) {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: st } = await supabaseAdmin
      .from("session_types")
      .select("is_online, is_recorded")
      .eq("id", appt.session_type_id)
      .single();
    isOnlineSession   = st?.is_online   ?? false;
    isRecordedSession = st?.is_recorded ?? true;
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
        autoRecord:      isRecordedSession,
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

// ── Soft delete ───────────────────────────────────────────────────────────────

/**
 * Exclui um agendamento da agenda (soft delete) e limpa Zoom/Google (best-effort).
 * Usa admin client escopado por `clinicId` — a política RLS de SELECT esconde linhas
 * com `deleted_at` preenchido, o que quebraria o RETURNING via client de usuário.
 */
export async function softDeleteAppointment(appointmentId: string, clinicId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("appointments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .select("clinic_id, google_event_id, zoom_meeting_id")
    .maybeSingle();
  if (error) throw error;

  if (data?.google_event_id) {
    import("@/services/google-calendar-service").then(({ deleteGoogleCalendarEvent }) =>
      deleteGoogleCalendarEvent(data.clinic_id, data.google_event_id as string).catch(() => {}),
    ).catch(() => {});
  }
  if (data?.zoom_meeting_id) {
    import("@/services/zoom-service").then(({ deleteZoomMeeting }) =>
      deleteZoomMeeting(data.clinic_id, data.zoom_meeting_id as string).catch(() => {}),
    ).catch(() => {});
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

  // Delete Zoom meeting if appointment is cancelled
  if (updates.status === "cancelled" && appt.zoom_meeting_id) {
    const { deleteZoomMeeting } = await import("@/services/zoom-service");
    deleteZoomMeeting(appt.clinic_id, appt.zoom_meeting_id).catch(
      (err: unknown) => console.error("Zoom meeting delete failed:", err)
    );
  }

  // Notify waitlist when a slot is freed (fire-and-forget)
  if (updates.status === "cancelled") {
    import("@/services/waitlist-service").then(async ({ notifyWaitlistOnCancellation }) => {
      // Fetch clinic slug for the booking link
      const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
      const admin = createSupabaseAdminClient();
      const { data: clinic } = await admin
        .from("clinics")
        .select("slug")
        .eq("id", appt.clinic_id)
        .maybeSingle();
      if (!clinic?.slug) return;

      const sessionType = Array.isArray(appt.session_types) ? appt.session_types[0] : appt.session_types;

      notifyWaitlistOnCancellation({
        clinicId:          appt.clinic_id,
        clinicSlug:        clinic.slug as string,
        cancelledStartsAt: appt.starts_at,
        sessionTypeName:   sessionType?.name ?? undefined,
      }).catch((err: unknown) => console.error("Waitlist notification failed:", err));
    }).catch((err: unknown) => console.error("Waitlist import failed:", err));
  }

  // Update Zoom meeting time if appointment is rescheduled
  if ((updates.starts_at || updates.duration_minutes) && appt.zoom_meeting_id) {
    const { updateZoomMeeting } = await import("@/services/zoom-service");
    updateZoomMeeting(appt.clinic_id, appt.zoom_meeting_id, {
      startIso:        updates.starts_at ?? appt.starts_at,
      durationMinutes: updates.duration_minutes ?? appt.duration_minutes,
    }).catch((err: unknown) => console.error("Zoom meeting update failed:", err));
  }

  return appt;
}

export async function getAppointmentsByPatient(patientId: string, limit = 100): Promise<Appointment[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status)")
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Appointment[];
}

/**
 * PERF-01: batch version — fetches appointments for multiple patients in one
 * query and returns a Map<patientId, Appointment[]>.
 */
export async function getAppointmentsByPatients(
  patientIds: string[],
): Promise<Map<string, Appointment[]>> {
  if (patientIds.length === 0) return new Map();

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, full_name, email, phone, status)")
    .in("patient_id", patientIds)
    .order("starts_at", { ascending: false });

  if (error) throw error;

  const map = new Map<string, Appointment[]>();
  for (const appt of (data ?? []) as Appointment[]) {
    const pid = appt.patient_id;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(appt);
  }
  return map;
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
