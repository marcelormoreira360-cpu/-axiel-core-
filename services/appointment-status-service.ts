import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";
import {
  CANCEL_TARGETS,
  DEFAULT_CANCELLATION_WINDOW_HOURS,
  isTransitionAllowed,
  classifyCancellationByWindow,
  type AppointmentStatus,
  type ActorType,
} from "@/modules/schedule/status-actions";

const log = createLogger("appointment-status-service");

// ── Máquina de estados ─────────────────────────────────────────────────────────
// A lógica PURA (máquina de transições, ações rápidas da equipe, janela de
// cancelamento) vive em @/modules/schedule/status-actions para ser importável pelo
// cliente sem arrastar o admin client. Reexportamos tudo aqui para não quebrar os
// imports existentes (o serviço segue sendo o ponto de entrada do lado servidor).
export * from "@/modules/schedule/status-actions";

export type AppointmentActor = {
  type: ActorType;
  /** id do usuário da equipe; null/undefined para paciente ou sistema. */
  userId?: string | null;
  reason?: string | null;
};

/** Lê clinics.cancellation_window_hours (fallback 24h). Usado pelo servidor e para
 * plumbar o valor até a UI (para pré-visualizar a classificação no diálogo). */
export async function getCancellationWindowHours(clinicId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("cancellation_window_hours")
    .eq("id", clinicId)
    .maybeSingle();

  return typeof clinic?.cancellation_window_hours === "number"
    ? clinic.cancellation_window_hours
    : DEFAULT_CANCELLATION_WINDOW_HOURS;
}

/**
 * Lê clinics.cancellation_window_hours (fallback 24h) e classifica o
 * cancelamento pela regra pura acima.
 */
export async function resolveCancellationStatus(
  clinicId: string,
  startsAt: string,
  now: Date = new Date(),
): Promise<"cancelled_notice" | "late_cancel"> {
  const windowHours = await getCancellationWindowHours(clinicId);
  return classifyCancellationByWindow(startsAt, windowHours, now);
}

// ── Transição central ──────────────────────────────────────────────────────────

export type ChangeStatusResult =
  | { ok: true; status: AppointmentStatus; changed: boolean; appointmentId: string }
  | { ok: false; error: string; code: "NOT_FOUND" | "NOT_ALLOWED" | "CONFLICT" | "DB_ERROR" };

type ApptRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  starts_at: string;
  status: string | null;
  google_event_id: string | null;
  zoom_meeting_id: string | null;
  session_types?: { name?: string | null } | { name?: string | null }[] | null;
};

/**
 * Ponto ÚNICO de mudança de status (equipe, paciente e sistema passam por aqui).
 * Valida a transição + o ator, aplica carimbos, grava o evento de auditoria e
 * dispara os hooks da Fase 2 (sem cobrança). Usa admin client (a ação do
 * paciente não é um usuário autenticado; a autorização é feita aqui na regra e,
 * no fluxo do paciente, pela validação do token antes de chamar esta função).
 *
 * Idempotente: se o status já for o alvo, retorna sucesso sem gravar evento novo.
 * Concorrência: o UPDATE é condicionado ao status atual (optimistic lock).
 */
export async function changeAppointmentStatus(input: {
  appointmentId: string;
  toStatus: AppointmentStatus;
  actor: AppointmentActor;
}): Promise<ChangeStatusResult> {
  const { appointmentId, toStatus, actor } = input;
  const supabase = createSupabaseAdminClient();

  const { data: appt, error: readErr } = await supabase
    .from("appointments")
    .select("id, clinic_id, patient_id, starts_at, status, google_event_id, zoom_meeting_id, session_types(name)")
    .eq("id", appointmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readErr) return { ok: false, error: "Erro ao carregar o agendamento.", code: "DB_ERROR" };
  if (!appt) return { ok: false, error: "Agendamento não encontrado.", code: "NOT_FOUND" };

  const row = appt as ApptRow;
  const fromStatus = (row.status ?? "scheduled") as AppointmentStatus;

  // Idempotência: já está no alvo → sucesso sem novo evento.
  if (fromStatus === toStatus) {
    return { ok: true, status: toStatus, changed: false, appointmentId };
  }

  if (!isTransitionAllowed(fromStatus, toStatus, actor.type)) {
    return { ok: false, error: "Transição de status não permitida.", code: "NOT_ALLOWED" };
  }

  // Carimbos de conveniência por transição.
  const nowIso = new Date().toISOString();
  const updates: Record<string, string | null> = { status: toStatus };
  if (toStatus === "confirmed") updates.confirmed_at = nowIso;
  if (toStatus === "checked_in") updates.checked_in_at = nowIso;
  if (toStatus === "completed") updates.completed_at = nowIso;
  if (CANCEL_TARGETS.includes(toStatus)) {
    updates.cancelled_at = nowIso;
    updates.cancelled_by_role = actor.type;
  }

  // Optimistic lock: só muda se o status ainda for o que lemos.
  const { data: updated, error: updErr } = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", appointmentId)
    .eq("status", fromStatus)
    .select("id");

  if (updErr) return { ok: false, error: "Erro ao atualizar o status.", code: "DB_ERROR" };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "O status mudou enquanto você agia. Recarregue e tente de novo.", code: "CONFLICT" };
  }

  // Log de auditoria (fonte de verdade do relatório). Best-effort: falha aqui
  // não desfaz a transição, mas é logada.
  const { error: evtErr } = await supabase.from("appointment_status_events").insert({
    clinic_id: row.clinic_id,
    appointment_id: appointmentId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by_user: actor.type === "staff" ? actor.userId ?? null : null,
    actor_type: actor.type,
    reason: actor.reason ?? null,
  });
  if (evtErr) log.error("Falha ao gravar appointment_status_events", evtErr, { appointmentId, toStatus });

  // Hooks da Fase 2 (só registram o evento; nenhuma cobrança). Fire-and-forget.
  dispatchLifecycleEvents(row, toStatus).catch((e) =>
    log.error("Falha ao despachar lifecycle events", e as Error, { appointmentId, toStatus }),
  );

  // Side-effects de cancelamento (limpar Zoom/Google + avisar lista de espera).
  if (CANCEL_TARGETS.includes(toStatus)) {
    runCancellationSideEffects(row).catch((e) =>
      log.error("Falha nos side-effects de cancelamento", e as Error, { appointmentId }),
    );
  }

  return { ok: true, status: toStatus, changed: true, appointmentId };
}

/**
 * Cancela um agendamento aplicando a regra de janela da clínica. Usado tanto pela
 * equipe quanto pelo fluxo self-service do paciente (após validar o token).
 */
export async function cancelAppointment(input: {
  appointmentId: string;
  clinicId: string;
  startsAt: string;
  actor: AppointmentActor;
}): Promise<ChangeStatusResult> {
  const target = await resolveCancellationStatus(input.clinicId, input.startsAt);
  return changeAppointmentStatus({ appointmentId: input.appointmentId, toStatus: target, actor: input.actor });
}

/**
 * Caminho da EQUIPE (server action da agenda). Enforça o escopo de clínica
 * (o motor usa admin client e ignora RLS) e traduz os atalhos da UI atual para
 * a máquina de estados:
 *  - 'cancelled' (ou cancelled_notice/late_cancel) → cancelAppointment (janela).
 *  - 'completed' a partir de scheduled/confirmed → faz check-in automático e
 *    depois conclui (2 eventos auditados), respeitando o caminho da máquina.
 *  - demais → changeAppointmentStatus direto.
 */
export async function changeAppointmentStatusForStaff(input: {
  appointmentId: string;
  requested: string;
  userId: string;
  clinicId?: string | null;
  reason?: string | null;
}): Promise<ChangeStatusResult> {
  const { appointmentId, requested, userId } = input;
  const supabase = createSupabaseAdminClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, clinic_id, starts_at, status")
    .eq("id", appointmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!appt) return { ok: false, error: "Agendamento não encontrado.", code: "NOT_FOUND" };

  // Escopo de clínica: staff só age na própria clínica. clinicId null = admin
  // (perfil sem clínica única), que pode agir em qualquer uma.
  if (input.clinicId && appt.clinic_id !== input.clinicId) {
    return { ok: false, error: "Sem acesso a este agendamento.", code: "NOT_ALLOWED" };
  }

  const actor: AppointmentActor = { type: "staff", userId, reason: input.reason ?? null };

  // Cancelamento: classifica pela janela da clínica.
  if (requested === "cancelled" || requested === "cancelled_notice" || requested === "late_cancel") {
    return cancelAppointment({ appointmentId, clinicId: appt.clinic_id, startsAt: appt.starts_at, actor });
  }

  // Concluir a partir de scheduled/confirmed: check-in automático + concluir.
  const from = (appt.status ?? "scheduled") as AppointmentStatus;
  if (requested === "completed" && (from === "scheduled" || from === "confirmed")) {
    const step1 = await changeAppointmentStatus({ appointmentId, toStatus: "checked_in", actor });
    if (!step1.ok) return step1;
    return changeAppointmentStatus({ appointmentId, toStatus: "completed", actor });
  }

  return changeAppointmentStatus({ appointmentId, toStatus: requested as AppointmentStatus, actor });
}

// ── Hooks da Fase 2 (outbox append-only; sem lógica de cobrança) ────────────────

async function dispatchLifecycleEvents(row: ApptRow, toStatus: AppointmentStatus): Promise<void> {
  if (toStatus !== "late_cancel" && toStatus !== "no_show") return;
  const supabase = createSupabaseAdminClient();

  // 1) Taxa a DECIDIR (não é débito). A Fase 2 lê e Marcelo/Dayane resolvem.
  await supabase.from("appointment_lifecycle_events").insert({
    clinic_id: row.clinic_id,
    appointment_id: row.id,
    patient_id: row.patient_id,
    event_type: "fee_decision_pending",
    trigger_status: toStatus,
    payload: { starts_at: row.starts_at },
  });

  // 2) Flag de retenção: paciente com 2+ no_show no histórico (conta no log,
  //    via join com appointments para escopar ao paciente).
  if (toStatus === "no_show") {
    const { count: patientNoShows } = await supabase
      .from("appointment_status_events")
      .select("id, appointments!inner(patient_id)", { count: "exact", head: true })
      .eq("clinic_id", row.clinic_id)
      .eq("to_status", "no_show")
      .eq("appointments.patient_id", row.patient_id);

    const total = patientNoShows ?? 0;
    if (total >= 2) {
      await supabase.from("appointment_lifecycle_events").insert({
        clinic_id: row.clinic_id,
        appointment_id: row.id,
        patient_id: row.patient_id,
        event_type: "repeated_no_show",
        trigger_status: toStatus,
        payload: { no_show_count: total },
      });
    }
  }
}

// ── Side-effects de cancelamento (reaproveita integrações existentes) ───────────

async function runCancellationSideEffects(row: ApptRow): Promise<void> {
  if (row.google_event_id) {
    const { deleteGoogleCalendarEvent } = await import("@/services/google-calendar-service");
    await deleteGoogleCalendarEvent(row.clinic_id, row.google_event_id).catch(() => {});
  }
  if (row.zoom_meeting_id) {
    const { deleteZoomMeeting } = await import("@/services/zoom-service");
    await deleteZoomMeeting(row.clinic_id, row.zoom_meeting_id).catch(() => {});
  }

  // Avisa a lista de espera que um horário abriu.
  try {
    const supabase = createSupabaseAdminClient();
    const { data: clinic } = await supabase.from("clinics").select("slug").eq("id", row.clinic_id).maybeSingle();
    if (!clinic?.slug) return;
    const st = Array.isArray(row.session_types) ? row.session_types[0] : row.session_types;
    const { notifyWaitlistOnCancellation } = await import("@/services/waitlist-service");
    await notifyWaitlistOnCancellation({
      clinicId: row.clinic_id,
      clinicSlug: clinic.slug as string,
      cancelledStartsAt: row.starts_at,
      sessionTypeName: st?.name ?? undefined,
    }).catch(() => {});
  } catch {
    /* best-effort */
  }
}
