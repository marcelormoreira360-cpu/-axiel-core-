/**
 * Aceite da política de no-show / cancelamento tardio.
 *
 * Fonte da verdade: a tabela append-only public.patient_consents (migration 045),
 * com consent_type='no_show_policy' + policy_version + appointment_id (migration
 * 143, Opção A do Lex). Cada aceite é uma linha nova; o ESTADO ATUAL é a linha mais
 * recente (created_at DESC) para o paciente.
 *
 * Este módulo NÃO cobra nada. Só REGISTRA e LÊ o aceite. A cobrança ao paciente
 * continua travada (Fase 2) até aprovação do texto (Marcelo) + advogado humano.
 *
 * Espelha o padrão de services/channel-consent-service.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { NO_SHOW_POLICY_VERSION } from "@/modules/no-show-policy/policy-text";

export const NO_SHOW_CONSENT_TYPE = "no_show_policy";

/**
 * Decisão PURA do guard de servidor (Lex 2.1): bloquear a criação do agendamento
 * por falta de aceite? Só bloqueia quando (a) o canal exige o aceite (enforce, ligado
 * no booking web e desligado na voz), (b) a clínica cobra falta/cancelamento tardio,
 * e (c) o aceite NÃO veio. Testável isolado do banco.
 */
export function shouldBlockBookingForPolicyConsent(input: {
  enforce: boolean;
  clinicCharges: boolean;
  accepted: boolean;
}): boolean {
  return input.enforce && input.clinicCharges && !input.accepted;
}

/** Canais de onde o aceite pode vir (livre, como patient_consents.source). */
export type NoShowConsentSource =
  | "website"
  | "confirm_link"
  | "self_register"
  | "voice"
  | "intake"
  | "manual";

export type RecordNoShowConsentInput = {
  clinicId: string;
  patientId: string;
  /** Agendamento que originou o aceite (prova de vínculo). */
  appointmentId?: string | null;
  /** Versão do texto aceito. Default = versão vigente do repo (server-side). */
  policyVersion?: string;
  /** true = aceite; false = revogação (append-only, nova linha). Default true. */
  granted?: boolean;
  source?: NoShowConsentSource;
  ip?: string | null;
  userAgent?: string | null;
  notes?: string | null;
};

/**
 * Registra o aceite da política. NUNCA faz update: cada aceite vira uma linha nova,
 * preservando o histórico (append-only). Guarda ip/user_agent/source + policy_version
 * + appointment_id como prova para eventual disputa (chargeback).
 *
 * IMPORTANTE (minimização, lente Selo): não passar dado clínico em `notes`. Só
 * metadado de consentimento.
 */
export async function recordNoShowPolicyConsent(
  input: RecordNoShowConsentInput,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? createSupabaseAdminClient();
  const { error } = await supabase.from("patient_consents").insert({
    clinic_id: input.clinicId,
    patient_id: input.patientId,
    consent_type: NO_SHOW_CONSENT_TYPE,
    granted: input.granted ?? true,
    policy_version: input.policyVersion ?? NO_SHOW_POLICY_VERSION,
    appointment_id: input.appointmentId ?? null,
    ip_address: input.ip ?? null,
    user_agent: input.userAgent ?? null,
    source: input.source ?? "website",
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

export type NoShowConsentState = {
  granted: boolean;
  policyVersion: string | null;
  appointmentId: string | null;
  createdAt: string;
};

/** Estado atual do aceite da política para o paciente (linha mais recente). */
export async function getNoShowPolicyConsent(
  patientId: string,
  client?: SupabaseClient,
): Promise<NoShowConsentState | null> {
  const supabase = client ?? createSupabaseAdminClient();
  const { data } = await supabase
    .from("patient_consents")
    .select("granted, policy_version, appointment_id, created_at")
    .eq("patient_id", patientId)
    .eq("consent_type", NO_SHOW_CONSENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    granted?: boolean;
    policy_version?: string | null;
    appointment_id?: string | null;
    created_at: string;
  };
  return {
    granted: row.granted === true,
    policyVersion: row.policy_version ?? null,
    appointmentId: row.appointment_id ?? null,
    createdAt: row.created_at,
  };
}

/**
 * O paciente aceitou a política? Opcionalmente exige uma versão específica (a
 * clínica pode exigir reaceite quando a versão vigente muda — seção 3.5 do Lex).
 */
export async function hasAcceptedNoShowPolicy(
  patientId: string,
  requiredVersion?: string,
  client?: SupabaseClient,
): Promise<boolean> {
  const state = await getNoShowPolicyConsent(patientId, client);
  if (!state || !state.granted) return false;
  if (requiredVersion && state.policyVersion !== requiredVersion) return false;
  return true;
}

/**
 * Para a fila de decisão de taxa (seção 2.3 do Lex): quais AGENDAMENTOS têm um
 * aceite de política em arquivo. Devolve o conjunto de appointment_id com aceite
 * granted. Um appointment 100% interno (sem clique do paciente) NÃO estará no
 * conjunto -> a fila mostra "consentimento: ausente".
 */
export async function getNoShowConsentAppointments(
  appointmentIds: string[],
  client?: SupabaseClient,
): Promise<Set<string>> {
  const present = new Set<string>();
  if (appointmentIds.length === 0) return present;

  const supabase = client ?? createSupabaseAdminClient();
  const { data } = await supabase
    .from("patient_consents")
    .select("appointment_id, granted")
    .eq("consent_type", NO_SHOW_CONSENT_TYPE)
    .in("appointment_id", appointmentIds);

  for (const row of (data ?? []) as Array<{ appointment_id: string | null; granted: boolean }>) {
    if (row.granted && row.appointment_id) present.add(row.appointment_id);
  }
  return present;
}
