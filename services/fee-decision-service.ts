import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("fee-decision-service");

// ─────────────────────────────────────────────────────────────────────────────
// Fase 2 do ciclo de status do agendamento: DECISÃO HUMANA de taxa de falta /
// cancelamento tardio + flag de retenção. Ver TICKET_Status_Agendamento_Fase2.md.
//
// NENHUMA cobrança automática. A taxa só vira recebível quando a equipe decide
// "Cobrar" (decidirCobrar). O disparo REAL da cobrança ao paciente é do fluxo do
// Cobro e depende do gate de consentimento (Lex): NÃO deve ir ao ar sem ele.
// Este serviço só materializa a pendência, calcula o valor SUGERIDO a partir da
// config da clínica e registra a decisão + o vínculo financeiro interno.
// ─────────────────────────────────────────────────────────────────────────────

export type FeeTriggerStatus = "late_cancel" | "no_show";
export type FeeDecisionState = "pendente_decisao" | "cobrar" | "dispensar";
export type FeeMode = "percent" | "fixed" | "none";

/** Config de taxa de uma clínica (colunas de public.clinics, migration 142). */
export type ClinicFeeConfig = {
  no_show_fee_mode: FeeMode;
  no_show_fee_percent: number | null;
  no_show_fee_min_cents: number | null;
  no_show_fee_max_cents: number | null;
  late_cancel_fee_mode: FeeMode;
  late_cancel_fee_percent: number | null;
  late_cancel_fee_min_cents: number | null;
  late_cancel_fee_max_cents: number | null;
  first_miss_courtesy: boolean;
};

const FEE_CONFIG_COLUMNS =
  "no_show_fee_mode, no_show_fee_percent, no_show_fee_min_cents, no_show_fee_max_cents, " +
  "late_cancel_fee_mode, late_cancel_fee_percent, late_cancel_fee_min_cents, late_cancel_fee_max_cents, " +
  "first_miss_courtesy";

/**
 * A clínica cobra por falta OU cancelamento tardio? (algum modo != 'none'.)
 * Usado pelo gate de consentimento (Lex 2.1): só se a clínica cobra é que o aceite
 * da política é EXIGIDO antes de agendar. Clínica em modo 'none'/'none' não precisa
 * do aceite para agendar (não há taxa a defender).
 */
export function clinicChargesForMisses(
  config: Pick<ClinicFeeConfig, "no_show_fee_mode" | "late_cancel_fee_mode">,
): boolean {
  return config.no_show_fee_mode !== "none" || config.late_cancel_fee_mode !== "none";
}

/** Lê só os dois modos de taxa da clínica (leitura barata para o gate de booking). */
export async function getClinicFeeModes(
  clinicId: string,
): Promise<{ no_show_fee_mode: FeeMode; late_cancel_fee_mode: FeeMode }> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("clinics")
    .select("no_show_fee_mode, late_cancel_fee_mode")
    .eq("id", clinicId)
    .maybeSingle();
  return {
    no_show_fee_mode: (data?.no_show_fee_mode as FeeMode | undefined) ?? "percent",
    late_cancel_fee_mode: (data?.late_cancel_fee_mode as FeeMode | undefined) ?? "percent",
  };
}

// ── Cálculo do valor sugerido (PURO, testável; não toca no banco) ──────────────
// Lê a config da clínica + o preço da sessão; nunca há valor de taxa constante no
// código. O valor final é sempre confirmado por humano ao decidir "Cobrar".

export type SuggestedFeeReason = "none" | "courtesy" | "fixed" | "percent" | "percent_fallback";

export type SuggestedFee = {
  amountCents: number;
  /** Por que este valor: none = clínica não cobra; courtesy = 1ª falta; fixed;
   *  percent = percentual com clamp; percent_fallback = sessão sem preço, caiu no piso. */
  reason: SuggestedFeeReason;
};

function clampCents(value: number, minCents: number | null, maxCents: number | null): number {
  let out = value;
  if (typeof minCents === "number" && out < minCents) out = minCents;
  if (typeof maxCents === "number" && out > maxCents) out = maxCents;
  return Math.max(0, Math.round(out));
}

/**
 * Valor SUGERIDO da taxa a partir da config da clínica. Regra (ticket §2.0.1):
 *  - mode='none'                         -> 0 (clínica não cobra este caso)
 *  - first_miss_courtesy e 1ª ocorrência -> 0 (cortesia)
 *  - mode='fixed'                        -> *_fee_min_cents (ou 0)
 *  - mode='percent'                      -> preço da sessão * percent%, com piso/teto;
 *                                           FALLBACK no piso quando falta preço.
 */
export function computeSuggestedFee(input: {
  triggerStatus: FeeTriggerStatus;
  config: ClinicFeeConfig;
  sessionPriceCents: number | null;
  /** true se esta é a 1ª falta/cancelamento tardio do paciente (contando esta). */
  isFirstOccurrence: boolean;
}): SuggestedFee {
  const { triggerStatus, config, sessionPriceCents, isFirstOccurrence } = input;

  const mode = triggerStatus === "no_show" ? config.no_show_fee_mode : config.late_cancel_fee_mode;
  const percent = triggerStatus === "no_show" ? config.no_show_fee_percent : config.late_cancel_fee_percent;
  const minCents = triggerStatus === "no_show" ? config.no_show_fee_min_cents : config.late_cancel_fee_min_cents;
  const maxCents = triggerStatus === "no_show" ? config.no_show_fee_max_cents : config.late_cancel_fee_max_cents;

  if (mode === "none") return { amountCents: 0, reason: "none" };
  if (config.first_miss_courtesy && isFirstOccurrence) return { amountCents: 0, reason: "courtesy" };

  if (mode === "fixed") {
    return { amountCents: Math.max(0, Math.round(minCents ?? 0)), reason: "fixed" };
  }

  // mode === 'percent'
  const base = sessionPriceCents ?? 0;
  if (!base || base <= 0) {
    // Fallback fixo quando a sessão não tem preço: nunca falhar por falta de preço.
    return { amountCents: Math.max(0, Math.round(minCents ?? 0)), reason: "percent_fallback" };
  }
  const bruto = (base * (percent ?? 0)) / 100;
  return { amountCents: clampCents(bruto, minCents, maxCents), reason: "percent" };
}

// ── Moeda da clínica via admin client (drain roda sem sessão no cron) ───────────
async function getClinicCurrencyAdmin(clinicId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("clinic_settings")
    .select("default_currency, settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const fromCol = (data?.default_currency as string | null) ?? null;
  const fromJson = ((data?.settings as Record<string, unknown> | null)?.default_currency as string | undefined) ?? null;
  return (fromCol || fromJson || "BRL").toUpperCase();
}

// ── Ocorrências de falta/cancelamento tardio do paciente (para a cortesia) ─────
// Conta no_show + late_cancel no log append-only appointment_status_events,
// escopado ao paciente via join com appointments (mesmo padrão da Fase 1).
async function countPatientMisses(clinicId: string, patientId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("appointment_status_events")
    .select("id, appointments!inner(patient_id)", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .in("to_status", ["no_show", "late_cancel"])
    .eq("appointments.patient_id", patientId);
  return count ?? 0;
}

// ── Drain do outbox: materializa fee_decision_pending em pendências ─────────────
// RECOMENDAÇÃO do ticket (§2.3): drain-on-read na abertura da fila, com o cron
// como rede de segurança. Idempotente em dois níveis: on conflict(appointment_id)
// do nothing + consumed_at. Rodar nos dois lugares é seguro.

export async function drainFeeDecisionEvents(clinicId: string): Promise<{ materialized: number; consumed: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: events, error } = await supabase
    .from("appointment_lifecycle_events")
    .select("id, clinic_id, appointment_id, patient_id, trigger_status")
    .eq("clinic_id", clinicId)
    .eq("event_type", "fee_decision_pending")
    .is("consumed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    log.error("Falha ao ler fee_decision_pending", error, { clinicId });
    return { materialized: 0, consumed: 0 };
  }
  if (!events?.length) return { materialized: 0, consumed: 0 };

  const currency = await getClinicCurrencyAdmin(clinicId);
  const consumedIds: string[] = [];
  let materialized = 0;

  for (const ev of events) {
    if (!ev.appointment_id || !ev.patient_id) {
      // Evento malformado: marca consumido para não travar a fila.
      consumedIds.push(ev.id);
      continue;
    }
    const trigger = (ev.trigger_status as FeeTriggerStatus) ?? "no_show";
    const { error: insErr } = await supabase
      .from("appointment_fee_decisions")
      .insert({
        clinic_id: ev.clinic_id,
        appointment_id: ev.appointment_id,
        patient_id: ev.patient_id,
        trigger_status: trigger,
        currency,
      })
      .select("id")
      .maybeSingle();

    // 23505 = unique_violation (on conflict do nothing manual): pendência já existe.
    if (insErr && insErr.code !== "23505") {
      log.error("Falha ao materializar pendência de taxa", insErr, { appointmentId: ev.appointment_id });
      continue; // não marca consumido: tenta de novo no próximo drain
    }
    if (!insErr) materialized += 1;
    consumedIds.push(ev.id);
  }

  if (consumedIds.length) {
    const { error: updErr } = await supabase
      .from("appointment_lifecycle_events")
      .update({ consumed_at: new Date().toISOString() })
      .in("id", consumedIds);
    if (updErr) log.error("Falha ao marcar fee_decision_pending consumidos", updErr, { clinicId });
  }

  return { materialized, consumed: consumedIds.length };
}

// ── Fila de decisão (leitura): calcula o valor sugerido na hora ────────────────

export type FeeDecisionRow = {
  id: string;
  appointment_id: string;
  patient_id: string;
  patient_name: string | null;
  trigger_status: FeeTriggerStatus;
  state: FeeDecisionState;
  starts_at: string | null;
  session_type_name: string | null;
  session_price_cents: number | null;
  currency: string;
  suggested_amount_cents: number;
  suggested_reason: SuggestedFeeReason;
  amount_cents: number | null; // valor firmado quando 'cobrar'
  decided_at: string | null;
  notes: string | null;
  created_at: string;
  /**
   * Há aceite da política de no-show EM ARQUIVO para este agendamento? (Lex 2.3.)
   * false num agendamento 100% interno (recepção marcou, paciente não clicou) —
   * sinaliza que uma cobrança aqui seria frágil por falta de consentimento prévio.
   * Só um INDICADOR; não bloqueia nem decide. A cobrança real segue travada.
   */
  consent_present: boolean;
};

export async function getFeeDecisions(
  clinicId: string,
  opts: { state?: FeeDecisionState } = {},
): Promise<FeeDecisionRow[]> {
  const supabase = createSupabaseAdminClient();

  // Config da clínica (uma leitura; serve para todas as linhas).
  const { data: clinic } = await supabase
    .from("clinics")
    .select(FEE_CONFIG_COLUMNS)
    .eq("id", clinicId)
    .maybeSingle();
  const config = (clinic as unknown as ClinicFeeConfig | null) ?? DEFAULT_FEE_CONFIG;

  let q = supabase
    .from("appointment_fee_decisions")
    .select(
      "id, appointment_id, patient_id, trigger_status, state, currency, amount_cents, decided_at, notes, created_at, " +
        "patients(full_name), appointments(starts_at, session_types(name, price_cents))",
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (opts.state) q = q.eq("state", opts.state);

  const { data, error } = await q;
  if (error) throw error;

  // Cast: appointment_fee_decisions é tabela nova (fora dos tipos gerados do
  // Supabase) e o select com join degrada a inferência. Modelamos a linha crua.
  type RawRow = {
    id: string;
    appointment_id: string;
    patient_id: string;
    trigger_status: string;
    state: string;
    currency: string;
    amount_cents: number | null;
    decided_at: string | null;
    notes: string | null;
    created_at: string;
    patients: { full_name?: string } | { full_name?: string }[] | null;
    appointments:
      | { starts_at?: string; session_types?: { name?: string; price_cents?: number } | { name?: string; price_cents?: number }[] | null }
      | { starts_at?: string; session_types?: { name?: string; price_cents?: number } | { name?: string; price_cents?: number }[] | null }[]
      | null;
  };

  // Contagem de ocorrências por paciente (para a cortesia da 1ª falta), só para os
  // que estão pendentes (a sugestão só importa em pendente_decisao).
  const rows = (data ?? []) as unknown as RawRow[];
  const pendingPatientIds = Array.from(
    new Set(rows.filter((r) => r.state === "pendente_decisao").map((r) => r.patient_id)),
  );
  const missCountByPatient = new Map<string, number>();
  await Promise.all(
    pendingPatientIds.map(async (pid) => {
      missCountByPatient.set(pid, await countPatientMisses(clinicId, pid));
    }),
  );

  // Indicador de consentimento (Lex 2.3): quais agendamentos têm aceite em arquivo.
  // Batch numa consulta; agendamento interno sem clique do paciente vem ausente.
  const { getNoShowConsentAppointments } = await import("@/services/no-show-consent-service");
  const consentAppointments = await getNoShowConsentAppointments(
    Array.from(new Set(rows.map((r) => r.appointment_id))),
  ).catch(() => new Set<string>());

  return rows.map((row) => {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
    const appt = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
    const st = appt
      ? Array.isArray((appt as { session_types?: unknown }).session_types)
        ? (appt as { session_types: Array<{ name?: string; price_cents?: number }> }).session_types[0]
        : (appt as { session_types?: { name?: string; price_cents?: number } }).session_types
      : null;
    const trigger = row.trigger_status as FeeTriggerStatus;
    const price = (st as { price_cents?: number } | null)?.price_cents ?? null;

    const suggested =
      row.state === "pendente_decisao"
        ? computeSuggestedFee({
            triggerStatus: trigger,
            config,
            sessionPriceCents: price,
            isFirstOccurrence: (missCountByPatient.get(row.patient_id) ?? 1) <= 1,
          })
        : { amountCents: row.amount_cents ?? 0, reason: "percent" as SuggestedFeeReason };

    return {
      id: row.id,
      appointment_id: row.appointment_id,
      patient_id: row.patient_id,
      patient_name: (patient as { full_name?: string } | null)?.full_name ?? null,
      trigger_status: trigger,
      state: row.state as FeeDecisionState,
      starts_at: (appt as { starts_at?: string } | null)?.starts_at ?? null,
      session_type_name: (st as { name?: string } | null)?.name ?? null,
      session_price_cents: price,
      currency: row.currency,
      suggested_amount_cents: suggested.amountCents,
      suggested_reason: suggested.reason,
      amount_cents: row.amount_cents,
      decided_at: row.decided_at,
      notes: row.notes,
      created_at: row.created_at,
      consent_present: consentAppointments.has(row.appointment_id),
    };
  });
}

/** Lê a política de taxa da clínica (colunas de public.clinics), com fallback no seed. */
export async function getClinicFeeConfig(clinicId: string): Promise<ClinicFeeConfig> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("clinics").select(FEE_CONFIG_COLUMNS).eq("id", clinicId).maybeSingle();
  return (data as unknown as ClinicFeeConfig | null) ?? DEFAULT_FEE_CONFIG;
}

const DEFAULT_FEE_CONFIG: ClinicFeeConfig = {
  no_show_fee_mode: "percent",
  no_show_fee_percent: 50,
  no_show_fee_min_cents: 5000,
  no_show_fee_max_cents: 15000,
  late_cancel_fee_mode: "percent",
  late_cancel_fee_percent: 25,
  late_cancel_fee_min_cents: 2500,
  late_cancel_fee_max_cents: 7500,
  first_miss_courtesy: true,
};

/** Contador para o badge da fila (pendências ainda por decidir). */
export async function countPendingFeeDecisions(clinicId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("appointment_fee_decisions")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("state", "pendente_decisao");
  return count ?? 0;
}

// ── Decisões humanas (movem o estado terminal) ─────────────────────────────────

export type DecideResult = { ok: true } | { ok: false; error: string };

/**
 * Decide COBRAR a taxa: grava state='cobrar', amount_cents, decided_by_user/at, e
 * faz o HANDOFF financeiro (Rota A): cria um recebível INTERNO 'pending' em
 * patient_payments vinculado ao appointment, guardando patient_payment_id.
 *
 * IMPORTANTE: isto NÃO dispara cobrança de cartão nem chamada externa. Só registra
 * o recebível interno para o Financeiro conciliar. A ativação da cobrança REAL ao
 * paciente depende do gate de consentimento (Lex) e do fluxo humano do Cobro.
 */
export async function decidirCobrar(input: {
  decisionId: string;
  clinicId: string;
  amountCents: number;
  decidedByUser: string | null;
  notes?: string | null;
}): Promise<DecideResult> {
  const { decisionId, clinicId, amountCents, decidedByUser, notes } = input;
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return { ok: false, error: "Valor inválido." };
  }
  const supabase = createSupabaseAdminClient();

  // Carrega a pendência (escopo de clínica + só age se ainda estiver pendente).
  const { data: decision, error: readErr } = await supabase
    .from("appointment_fee_decisions")
    .select("id, clinic_id, appointment_id, patient_id, trigger_status, state, currency")
    .eq("id", decisionId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (readErr) return { ok: false, error: "Erro ao carregar a pendência." };
  if (!decision) return { ok: false, error: "Pendência não encontrada." };
  if (decision.state !== "pendente_decisao") {
    return { ok: false, error: "Esta pendência já foi decidida." };
  }

  // Handoff Rota A: recebível INTERNO 'pending' (não dispara cobrança). Rótulo
  // neutro, sem dado clínico. createPaymentAdmin congela a moeda do paciente.
  let patientPaymentId: string | null = null;
  if (amountCents > 0) {
    try {
      const { createPaymentAdmin } = await import("@/services/finance-service");
      const label =
        decision.trigger_status === "no_show"
          ? "Taxa de falta (no-show)"
          : "Taxa de cancelamento tardio";
      const payment = await createPaymentAdmin({
        clinic_id: clinicId,
        patient_id: decision.patient_id,
        appointment_id: decision.appointment_id,
        amount_cents: amountCents,
        payment_method: "other",
        paid_at: new Date().toISOString(),
        notes: notes ? `${label}: ${notes}` : label,
        created_by: decidedByUser,
        status: "pending", // recebível a conciliar; NÃO é cobrança disparada
      });
      patientPaymentId = payment.id;
    } catch (e) {
      log.error("Falha ao criar recebível da taxa", e as Error, { decisionId });
      return { ok: false, error: "Não foi possível registrar o recebível da taxa." };
    }
  }

  const { data: updated, error: updErr } = await supabase
    .from("appointment_fee_decisions")
    .update({
      state: "cobrar",
      amount_cents: amountCents,
      decided_by_user: decidedByUser,
      decided_at: new Date().toISOString(),
      notes: notes ?? null,
      patient_payment_id: patientPaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", decisionId)
    .eq("clinic_id", clinicId)
    .eq("state", "pendente_decisao") // optimistic lock: não redecide
    .select("id");

  if (updErr) return { ok: false, error: "Erro ao gravar a decisão." };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "A pendência mudou enquanto você agia. Recarregue e tente de novo." };
  }
  return { ok: true };
}

/**
 * Decide DISPENSAR a taxa: grava state='dispensar', decided_by_user/at, notes
 * opcional. NÃO cria recebível nem cobrança.
 */
export async function decidirDispensar(input: {
  decisionId: string;
  clinicId: string;
  decidedByUser: string | null;
  notes?: string | null;
}): Promise<DecideResult> {
  const { decisionId, clinicId, decidedByUser, notes } = input;
  const supabase = createSupabaseAdminClient();

  const { data: updated, error: updErr } = await supabase
    .from("appointment_fee_decisions")
    .update({
      state: "dispensar",
      decided_by_user: decidedByUser,
      decided_at: new Date().toISOString(),
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", decisionId)
    .eq("clinic_id", clinicId)
    .eq("state", "pendente_decisao")
    .select("id");

  if (updErr) return { ok: false, error: "Erro ao gravar a decisão." };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Pendência não encontrada ou já decidida." };
  }
  return { ok: true };
}

// ── Consumidor de retenção (Fase 2C): repeated_no_show -> flag + follow-up ──────
// Acende patients.retention_risk_flagged_at e cria 1 follow-up para o fluxo do Elo,
// sem duplicar se já houver follow-up aberto de retenção para o paciente.
// Idempotente (drain-on-read/cron): marca consumed_at ao final.

const RETENTION_FOLLOWUP_TITLE = "Contato de retenção (faltas repetidas)";

export async function drainRetentionEvents(clinicId: string): Promise<{ flagged: number; followUps: number; consumed: number }> {
  const supabase = createSupabaseAdminClient();

  const { data: events, error } = await supabase
    .from("appointment_lifecycle_events")
    .select("id, clinic_id, appointment_id, patient_id")
    .eq("clinic_id", clinicId)
    .eq("event_type", "repeated_no_show")
    .is("consumed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    log.error("Falha ao ler repeated_no_show", error, { clinicId });
    return { flagged: 0, followUps: 0, consumed: 0 };
  }
  if (!events?.length) return { flagged: 0, followUps: 0, consumed: 0 };

  const consumedIds: string[] = [];
  let flagged = 0;
  let followUps = 0;

  for (const ev of events) {
    if (!ev.patient_id) {
      consumedIds.push(ev.id);
      continue;
    }

    // 1) Acende a flag (idempotente: só grava se ainda não estiver acesa).
    const { data: flagRes, error: flagErr } = await supabase
      .from("patients")
      .update({ retention_risk_flagged_at: new Date().toISOString() })
      .eq("id", ev.patient_id)
      .eq("clinic_id", ev.clinic_id)
      .is("retention_risk_flagged_at", null)
      .select("id");
    if (flagErr) {
      log.error("Falha ao acender flag de retenção", flagErr, { patientId: ev.patient_id });
      continue; // tenta de novo no próximo drain
    }
    if (flagRes && flagRes.length > 0) flagged += 1;

    // 2) Follow-up para o Elo, sem duplicar um aberto de retenção do paciente.
    const { data: existing } = await supabase
      .from("follow_ups")
      .select("id")
      .eq("clinic_id", ev.clinic_id)
      .eq("patient_id", ev.patient_id)
      .eq("status", "pending")
      .eq("title", RETENTION_FOLLOWUP_TITLE)
      .limit(1);

    if (!existing || existing.length === 0) {
      const { error: fuErr } = await supabase.from("follow_ups").insert({
        clinic_id: ev.clinic_id,
        patient_id: ev.patient_id,
        appointment_id: ev.appointment_id,
        title: RETENTION_FOLLOWUP_TITLE,
        due_at: new Date().toISOString(),
        channel: "none",
        notes: "Gerado automaticamente por faltas repetidas (retenção). Contato humano do time.",
      });
      if (fuErr) {
        log.error("Falha ao criar follow-up de retenção", fuErr, { patientId: ev.patient_id });
        continue;
      }
      followUps += 1;
    }

    consumedIds.push(ev.id);
  }

  if (consumedIds.length) {
    const { error: updErr } = await supabase
      .from("appointment_lifecycle_events")
      .update({ consumed_at: new Date().toISOString() })
      .in("id", consumedIds);
    if (updErr) log.error("Falha ao marcar repeated_no_show consumidos", updErr, { clinicId });
  }

  return { flagged, followUps, consumed: consumedIds.length };
}

// ── Rede de segurança (cron): drena o que ficou para trás em qualquer clínica ──
// Idempotente com o drain-on-read. Só toca clínicas que têm evento não consumido
// (lê os clinic_id distintos do outbox), então é barato mesmo com muitas clínicas.
export async function drainAllPendingLifecycleEvents(): Promise<{
  clinics: number;
  feeMaterialized: number;
  retentionFlagged: number;
}> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("appointment_lifecycle_events")
    .select("clinic_id")
    .is("consumed_at", null)
    .limit(5000);

  if (error) {
    log.error("Falha ao listar clínicas com eventos pendentes", error);
    return { clinics: 0, feeMaterialized: 0, retentionFlagged: 0 };
  }

  const clinicIds = Array.from(new Set((data ?? []).map((r) => r.clinic_id).filter(Boolean))) as string[];
  let feeMaterialized = 0;
  let retentionFlagged = 0;

  for (const clinicId of clinicIds) {
    const fee = await drainFeeDecisionEvents(clinicId).catch(() => ({ materialized: 0, consumed: 0 }));
    const ret = await drainRetentionEvents(clinicId).catch(() => ({ flagged: 0, followUps: 0, consumed: 0 }));
    feeMaterialized += fee.materialized;
    retentionFlagged += ret.flagged;
  }

  return { clinics: clinicIds.length, feeMaterialized, retentionFlagged };
}
