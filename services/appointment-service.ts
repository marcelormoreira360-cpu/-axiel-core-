import { createHash, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Appointment, AppointmentSource, SessionType } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import { generateSlots, dayOfWeekFromDate } from "@/lib/booking-utils";
import { getClinicTimezone } from "@/services/clinic-service";
import { normalizePhoneDigits } from "@/lib/phone";
import { scheduleAutomations } from "@/services/automation-service";
import { detectLanguage } from "@/lib/whatsapp-lang";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";

const log = createLogger("appointment-service");

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

/**
 * Conflito de horário: mesma clínica, intervalo sobreposto e mesmo profissional
 * (ou um dos lados sem profissional definido — clínica solo). Usa admin client
 * para funcionar também nas rotas públicas de booking. Ignora canceladas/no-show.
 */
export async function hasAppointmentConflict(opts: {
  clinic_id: string;
  starts_at: string;
  duration_minutes: number;
  practitioner_id?: string | null;
  exclude_appointment_id?: string | null;
}): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const start = new Date(opts.starts_at);
  const end = new Date(start.getTime() + opts.duration_minutes * 60_000);
  // Janela retroativa de 8h cobre qualquer sessão longa que ainda possa sobrepor
  const windowStart = new Date(start.getTime() - 8 * 60 * 60_000).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, duration_minutes, practitioner_id")
    .eq("clinic_id", opts.clinic_id)
    .gte("starts_at", windowStart)
    .lt("starts_at", end.toISOString())
    .not("status", "in", '("cancelled","no_show")');
  if (error) throw error;

  return (data ?? []).some((a) => {
    if (opts.exclude_appointment_id && a.id === opts.exclude_appointment_id) return false;
    const aStart = new Date(a.starts_at as string);
    const aEnd = new Date(aStart.getTime() + ((a.duration_minutes as number | null) ?? 60) * 60_000);
    const overlaps = aEnd > start && aStart < end;
    if (!overlaps) return false;
    const aPract = a.practitioner_id as string | null;
    const mine = opts.practitioner_id ?? null;
    return aPract === null || mine === null || aPract === mine;
  });
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

  if (await hasAppointmentConflict(input)) {
    throw new Error("Conflito de horário: já existe uma sessão nesse período.");
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...input, created_by: user?.id ?? null })
    .select("*, patients(id, full_name, email, phone, status, locale), session_types(id, name, duration_minutes, price_cents)")
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

  if (await hasAppointmentConflict(input)) {
    throw new Error("Conflito de horário: já existe uma sessão nesse período.");
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + (input.expiresInDays ?? 20) * 86_400_000).toISOString();

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
    }).catch((err: unknown) => log.error("Google Calendar update failed", err));
  }

  // Cancel Google Calendar event if appointment is cancelled
  if (updates.status === "cancelled" && appt.google_event_id) {
    const { deleteGoogleCalendarEvent } = await import("@/services/google-calendar-service");
    deleteGoogleCalendarEvent(appt.clinic_id, appt.google_event_id).catch(
      (err: unknown) => log.error("Google Calendar delete failed", err)
    );
  }

  // Delete Zoom meeting if appointment is cancelled
  if (updates.status === "cancelled" && appt.zoom_meeting_id) {
    const { deleteZoomMeeting } = await import("@/services/zoom-service");
    deleteZoomMeeting(appt.clinic_id, appt.zoom_meeting_id).catch(
      (err: unknown) => log.error("Zoom meeting delete failed", err)
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
      }).catch((err: unknown) => log.error("Waitlist notification failed", err));
    }).catch((err: unknown) => log.error("Waitlist import failed", err));
  }

  // Update Zoom meeting time if appointment is rescheduled
  if ((updates.starts_at || updates.duration_minutes) && appt.zoom_meeting_id) {
    const { updateZoomMeeting } = await import("@/services/zoom-service");
    updateZoomMeeting(appt.clinic_id, appt.zoom_meeting_id, {
      startIso:        updates.starts_at ?? appt.starts_at,
      durationMinutes: updates.duration_minutes ?? appt.duration_minutes,
    }).catch((err: unknown) => log.error("Zoom meeting update failed", err));
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
    patientLocale: (patient as { locale?: string | null }).locale ?? null,
    clinicName: clinic?.name ?? "nossa clínica",
    startsAt: appt.starts_at,
    durationMinutes: appt.duration_minutes,
  });
}

// ── Booking público (contexto sem sessão: site e voz) ──────────────────────────
// Estas duas funções concentram a lógica de disponibilidade e criação de
// agendamento que antes vivia inline nas rotas /api/book. Usam admin client
// (sem auth.getUser) para servir tanto o site quanto o canal de voz (Vapi).

type GetAvailableSlotsResult =
  | { ok: true; slots: { time: string; iso: string }[]; timezone: string }
  | { ok: false; error: string; code: string };

/**
 * Disponibilidade pública de horários para um dia/tipo de sessão. Espelho 1:1
 * do GET /api/book/[slug]/slots: resolve clínica ativa, lê timezone canônico do
 * clinic_settings (fallback Brasília), calcula os limites UTC do dia local pelo
 * método probe+offset, gera os slots e filtra os que já passaram. Devolve também
 * o timezone usado para quem precisar formatar a saída (ex.: voz).
 */
export async function getAvailableSlots(opts: {
  slug: string;
  date: string;
  sessionTypeId: string;
  practitionerId?: string | null;
}): Promise<GetAvailableSlotsResult> {
  const { slug, date, sessionTypeId } = opts;
  const practitionerId = opts.practitionerId ?? null;

  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return { ok: false, error: "Clínica não encontrada.", code: "CLINIC_NOT_FOUND" };

  // Fetch timezone from clinic_settings (fall back to Brasília if not set)
  const { data: clinicSettings } = await supabase
    .from("clinic_settings")
    .select("timezone, settings")
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  // Coluna `timezone` é a canônica (é o que /settings/regional grava);
  // o JSONB settings.timezone é legado e fica como fallback.
  const timezone: string =
    (clinicSettings?.timezone as string | null)
    ?? ((clinicSettings?.settings as Record<string, unknown> | null)?.timezone as string | undefined)
    ?? "America/Sao_Paulo";

  // Compute UTC boundaries for the requested wall-clock date in the clinic's TZ.
  // This ensures we capture all appointments that fall within that local day,
  // even when the clinic TZ is behind UTC (e.g. UTC-3 local midnight = UTC 03:00).
  const [year, month, day] = date.split("-").map(Number);
  // 00:00 and 23:59:59 wall-clock → UTC
  const probe00 = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const probe23 = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  const getOffset = (probe: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(probe);
    const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    return probe.getTime() - Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  };
  const dayStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + getOffset(probe00)).toISOString();
  const dayEndUTC   = new Date(Date.UTC(year, month - 1, day, 23, 59, 59) + getOffset(probe23)).toISOString();

  let bookedQuery = supabase
    .from("appointments")
    .select("starts_at")
    .eq("clinic_id", clinic.id)
    .not("status", "in", '("cancelled","no_show")')  // A-04: exclude cancelled slots
    .gte("starts_at", dayStartUTC)
    .lte("starts_at", dayEndUTC);

  if (practitionerId) {
    bookedQuery = bookedQuery.eq("practitioner_id", practitionerId);
  }

  const [{ data: sessionType }, { data: wh }, { data: booked }] = await Promise.all([
    supabase.from("session_types").select("duration_minutes").eq("id", sessionTypeId).eq("clinic_id", clinic.id).maybeSingle(),
    supabase.from("working_hours").select("opens_at, closes_at, is_open").eq("clinic_id", clinic.id).eq("day_of_week", dayOfWeekFromDate(date)).maybeSingle(),
    bookedQuery,
  ]);

  if (!sessionType) return { ok: false, error: "Tipo de sessão não encontrado.", code: "SESSION_TYPE_NOT_FOUND" };

  // Default hours if not configured
  const opensAt  = wh?.opens_at  ?? "09:00";
  const closesAt = wh?.closes_at ?? "17:00";
  const isOpen   = wh?.is_open   ?? (dayOfWeekFromDate(date) !== 0 && dayOfWeekFromDate(date) !== 6);

  // Dia fechado: sem horários (não é erro)
  if (!isOpen) return { ok: true, slots: [], timezone };

  const slots = generateSlots(
    date,
    opensAt,
    closesAt,
    sessionType.duration_minutes,
    (booked ?? []).map((a) => a.starts_at),
    timezone,
  );

  // Filter out past slots — slot.iso is now a proper UTC ISO so comparison with
  // `new Date()` (also UTC) correctly reflects the clinic's local wall-clock time.
  const now = new Date();
  const futureSlots = slots.filter((s) => new Date(s.iso) > now);

  return { ok: true, slots: futureSlots, timezone };
}

type CreatePublicBookingResult =
  | { ok: true; appointment_id: string; is_online: boolean; zoom_join_url: string | null }
  | { ok: false; error: string; code: string; status: number };

/**
 * Criação pública de agendamento. Espelho 1:1 do miolo do POST /api/book/[slug]:
 * resolve clínica, timezone, tipo de sessão, checa conflito de horário, faz
 * find/create do paciente (SEC-05/BUG-01), insere o agendamento e dispara TODOS
 * os side-effects fire-and-forget (questionários, Zoom, confirmação WhatsApp,
 * automações, push e e-mail Zoom) exatamente como antes.
 *
 * `source` default "website" (site) — o canal de voz passa "direct".
 * `locale` vem por parâmetro (o site passa o do cookie AXIEL_LOCALE).
 */
export async function createPublicBooking(input: {
  slug: string;
  session_type_id: string;
  starts_at: string;
  full_name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  practitioner_id?: string | null;
  locale?: string | null;
  source?: AppointmentSource;
}): Promise<CreatePublicBookingResult> {
  const {
    slug,
    session_type_id,
    starts_at,
    full_name,
    phone,
  } = input;
  const email = input.email ?? null;
  const notes = input.notes ?? null;
  const practitioner_id = input.practitioner_id ?? null;
  const bookingLocale = input.locale ?? null;
  const source: AppointmentSource = input.source ?? "website";
  const isEn = bookingLocale === "en";

  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return { ok: false, error: "Clínica não encontrada.", code: "CLINIC_NOT_FOUND", status: 404 };

  // Horários exibidos ao paciente sempre no fuso da clínica (o servidor roda em UTC)
  const clinicTz = await getClinicTimezone(clinic.id);

  // Fetch is_online alongside other session type fields
  const { data: sessionType } = await supabase
    .from("session_types")
    .select("id, name, duration_minutes, is_online")
    .eq("id", session_type_id)
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!sessionType) return { ok: false, error: "Tipo de sessão não encontrado.", code: "SESSION_TYPE_NOT_FOUND", status: 404 };

  // Slot pode ter sido tomado entre o carregamento da página e o submit
  if (await hasAppointmentConflict({
    clinic_id: clinic.id,
    starts_at,
    duration_minutes: sessionType.duration_minutes,
    practitioner_id: practitioner_id || null,
  })) {
    return { ok: false, error: "Este horário acabou de ser reservado. Escolha outro.", code: "SLOT_TAKEN", status: 409 };
  }

  // Find or create patient
  const normalizedPhone = normalizePhoneDigits(phone) ?? phone.replace(/\D/g, "");
  let patientId: string;

  // BUG-01: separate .eq() calls to avoid PostgREST filter injection
  // SEC-05: fetch existing email so we only update if the field was empty
  const { data: existing } = await supabase
    .from("patients")
    .select("id, email, locale")
    .eq("clinic_id", clinic.id)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  let existingByEmail: { id: string; email: string | null; locale: string | null } | null = null;
  if (!existing && email) {
    const { data } = await supabase
      .from("patients")
      .select("id, email, locale")
      .eq("clinic_id", clinic.id)
      .eq("email", email)
      .maybeSingle();
    existingByEmail = data ?? null;
  }

  const existingPatient = existing ?? existingByEmail;

  if (existingPatient) {
    patientId = existingPatient.id;
    // SEC-05: only enrich record if fields were previously empty
    const updates: Record<string, string> = {};
    if (email && !existingPatient.email) updates.email = email;
    if (bookingLocale && !existingPatient.locale) updates.locale = bookingLocale;
    if (Object.keys(updates).length > 0) {
      await supabase.from("patients").update(updates).eq("id", patientId);
    }
  } else {
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({ clinic_id: clinic.id, full_name, email: email || null, phone: normalizedPhone, status: "active", locale: bookingLocale })
      .select("id")
      .single();
    if (patientError) return { ok: false, error: "Erro ao registrar paciente.", code: "PATIENT_ERROR", status: 500 };
    patientId = newPatient.id;
  }

  // Create appointment
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinic.id,
      patient_id: patientId,
      session_type_id,
      starts_at,
      duration_minutes: sessionType.duration_minutes,
      source,
      notes: notes || null,
      practitioner_id: practitioner_id || null,
    })
    .select("id, clinic_id, patient_id, starts_at")
    .single();

  if (apptError) return { ok: false, error: "Erro ao criar agendamento.", code: "APPT_ERROR", status: 500 };

  // Questionários automáticos na 1ª sessão (fire-and-forget; usa admin client)
  import("@/services/onboarding-assessment-service").then(({ sendOnboardingAssessments }) =>
    sendOnboardingAssessments({ id: appointment.id, clinic_id: appointment.clinic_id, patient_id: appointment.patient_id }).catch(() => {})
  );

  // ── Zoom meeting (non-blocking) ─────────────────────────────────────────────
  // If the session type is online, create a Zoom meeting and store the URLs.
  // The join_url is returned to the patient so the booking page can display it.
  let zoomJoinUrl: string | null = null;

  if (sessionType.is_online) {
    try {
      const { createZoomMeeting } = await import("@/services/zoom-service");
      const firstName = full_name.split(" ")[0];
      const meeting = await createZoomMeeting(clinic.id, {
        topic:           `${sessionType.name} — ${full_name}`,
        startIso:        starts_at,
        durationMinutes: sessionType.duration_minutes,
        autoRecord:      true,
      });

      if (meeting) {
        zoomJoinUrl = meeting.join_url;
        await supabase.from("appointments").update({
          zoom_meeting_id: meeting.meeting_id,
          zoom_join_url:   meeting.join_url,
          zoom_start_url:  meeting.start_url,
        }).eq("id", appointment.id);

        log.info("Zoom meeting created for booking", {
          appointment_id: appointment.id,
          clinic_id: clinic.id,
          meeting_id: meeting.meeting_id,
        });

        // Send email with Zoom link if patient provided an email
        if (email) {
          sendZoomConfirmationEmail({
            to: email,
            firstName,
            clinicName: clinic.name as string,
            sessionName: sessionType.name,
            startsAt: starts_at,
            timeZone: clinicTz,
            joinUrl: meeting.join_url,
            locale: bookingLocale,
          }).catch((e) => log.error("Zoom email failed", e as Error, { appointment_id: appointment.id }));
        }
      }
    } catch (e) {
      // Non-blocking — appointment was already created; Zoom failure is logged but not fatal
      log.error("Zoom meeting creation failed for booking", e as Error, {
        appointment_id: appointment.id,
        clinic_id: clinic.id,
      });
    }
  }

  // ── WhatsApp confirmation via Meta template ─────────────────────────────────
  try {
    const metaToken = process.env.META_WHATSAPP_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    if (metaToken && phoneNumberId) {
      const metaPhone = normalizedPhone.replace(/^\+/, "");

      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("messages")
        .eq("phone", metaPhone)
        .maybeSingle();
      const history = (conv?.messages as Array<{ role: string; content: string }> | null) ?? [];
      const lang = detectLanguage(history, "");

      const date = new Date(starts_at);
      const firstName = full_name.split(" ")[0];

      let templateName: string;
      let langCode: string;
      let dateTimeStr: string;

      if (lang === "en") {
        templateName = "booking_confirmation_en";
        langCode = "en_US";
        const dateStr = date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: clinicTz });
        const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: clinicTz });
        dateTimeStr = `${dateStr} at ${timeStr}`;
      } else {
        templateName = "confirmacao_agendamento";
        langCode = "pt_BR";
        const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: clinicTz });
        const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: clinicTz });
        dateTimeStr = `${dateStr} às ${timeStr}`;
      }

      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${metaToken}` },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: metaPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: langCode },
            components: [{
              type: "body",
              parameters: [
                { type: "text", text: firstName },
                { type: "text", text: dateTimeStr },
                { type: "text", text: sessionType.name },
              ],
            }],
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        log.warn("WhatsApp template failed", { error: JSON.stringify(err), phone: normalizedPhone.slice(-4) });
      }

      // If online session and we have a Zoom link, send it as a follow-up text message.
      // This works because the patient just initiated contact via the booking page
      // and the 24h window is open (or we're in a session flow).
      if (zoomJoinUrl) {
        const linkMsg = lang === "en"
          ? `🖥️ Your session will be online. Join here:\n${zoomJoinUrl}`
          : `🖥️ Sua sessão será online. Entre pela reunião:\n${zoomJoinUrl}`;

        await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${metaToken}` },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaPhone,
            type: "text",
            text: { body: linkMsg },
          }),
        }).catch((e) => log.warn("Zoom WhatsApp link send failed", { error: String(e) }));
      }
    }
  } catch (e) {
    log.error("WhatsApp confirmation exception", e as Error, { appointment_id: appointment.id });
  }

  // Schedule automations (non-blocking)
  scheduleAutomations(appointment).catch(() => {});

  // Push notification to clinic staff — new online booking (non-blocking)
  const apptDate = new Date(starts_at).toLocaleString("pt-BR", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
    timeZone: clinicTz,
  });
  // Data no idioma do paciente para o push dele (staff continua pt)
  const patientApptDate = new Date(starts_at).toLocaleString(isEn ? "en-US" : "pt-BR", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
    timeZone: clinicTz,
  });
  import("@/services/push-service").then(({ sendPushToClinic, sendPushToPatient }) =>
    Promise.allSettled([
      sendPushToClinic(clinic.id, {
        title: "Novo agendamento",
        body:  `${full_name} · ${sessionType.name} · ${apptDate}`,
        url:   "/schedule",
        tag:   `booking-${appointment.id}`,
      }),
      // Notify the patient on their device
      sendPushToPatient(patientId, {
        title: isEn ? "Session confirmed ✓" : "Sessão confirmada ✓",
        body:  `${sessionType.name} · ${patientApptDate}`,
        tag:   `booking-confirm-${appointment.id}`,
      }),
    ])
  ).catch(() => {});

  return {
    ok: true,
    appointment_id: appointment.id,
    is_online: sessionType.is_online ?? false,
    zoom_join_url: zoomJoinUrl,
  };
}

// ── Zoom confirmation email ───────────────────────────────────────────────────
// Usado só por createPublicBooking (movido de app/api/book/[slug]/route.ts).

async function sendZoomConfirmationEmail(opts: {
  to: string;
  firstName: string;
  clinicName: string;
  sessionName: string;
  startsAt: string;
  joinUrl: string;
  timeZone: string;
  locale?: string | null;
}) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const isEn = opts.locale === "en";
  const dateLocale = isEn ? "en-US" : "pt-BR";
  const date = new Date(opts.startsAt);
  const dateStr = date.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: opts.timeZone });
  const timeStr = date.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit", timeZone: opts.timeZone });

  const s = isEn
    ? {
        subject: `Your online session link — ${opts.clinicName}`,
        heading: "Online session confirmed 🖥️",
        intro: `Hi, ${opts.firstName}! Your <strong>${opts.sessionName}</strong> session
          with <strong>${opts.clinicName}</strong> has been confirmed.`,
        dateLabel: "DATE AND TIME",
        dateTime: `${dateStr} at ${timeStr}`,
        button: "Join Zoom meeting",
        directAccess: "Or open the link directly:",
        sentBy: `Sent by ${opts.clinicName} via AXIEL Core`,
      }
    : {
        subject: `Link da sua sessão online — ${opts.clinicName}`,
        heading: "Sessão online confirmada 🖥️",
        intro: `Olá, ${opts.firstName}! Sua sessão de <strong>${opts.sessionName}</strong>
          com <strong>${opts.clinicName}</strong> foi confirmada.`,
        dateLabel: "DATA E HORA",
        dateTime: `${dateStr} às ${timeStr}`,
        button: "Entrar na reunião Zoom",
        directAccess: "Ou acesse diretamente:",
        sentBy: `Enviado por ${opts.clinicName} via AXIEL Core`,
      };

  await resend.emails.send({
    from: DEFAULT_FROM_EMAIL,
    to: opts.to,
    subject: s.subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0F1A2E">
        <h2 style="font-size:20px;font-weight:700;margin:0 0 8px">${s.heading}</h2>
        <p style="margin:0 0 16px;color:#6B6A66;font-size:14px">
          ${s.intro}
        </p>
        <div style="background:#F4F3EF;border-radius:10px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-size:13px;color:#A09E98;font-weight:600;text-transform:uppercase;letter-spacing:.05em">${s.dateLabel}</p>
          <p style="margin:0;font-size:16px;font-weight:600">${s.dateTime}</p>
        </div>
        <a href="${opts.joinUrl}"
           style="display:inline-block;background:#0F6E56;color:#fff;font-weight:600;font-size:15px;
                  padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:20px">
          ${s.button}
        </a>
        <p style="font-size:12px;color:#A09E98;margin:0">
          ${s.directAccess}<br>
          <a href="${opts.joinUrl}" style="color:#0F6E56;word-break:break-all">${opts.joinUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #E8E6E2;margin:24px 0">
        <p style="font-size:11px;color:#A09E98;margin:0">
          ${s.sentBy} · <a href="${APP_URL}" style="color:#A09E98">${APP_URL}</a>
        </p>
      </div>
    `,
  });
}
