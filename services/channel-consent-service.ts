/**
 * Opt-in por canal (item 3 do roadmap Fase 1).
 *
 * Fonte da verdade: a tabela append-only public.patient_consents (migration 045),
 * com consent_type no formato "channel_<canal>" (ver migration 132). Cada opt-in
 * ou opt-out e uma linha nova; o ESTADO ATUAL de um canal e a linha mais recente
 * (created_at DESC) daquele consent_type para o paciente.
 *
 * Este modulo NAO decide politica de envio (ex.: "dunning pode mandar WhatsApp
 * sem opt-in explicito?"). Ele so responde o estado consentido. Quem envia
 * (dunning, Clara, lembretes) aplica a propria regra a partir daqui.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const MESSAGING_CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "instagram",
  "messenger",
] as const;
export type MessagingChannel = (typeof MESSAGING_CHANNELS)[number];

export type ChannelConsentState = "opted_in" | "opted_out" | "unknown";

const CONSENT_TYPE_PREFIX = "channel_";

function channelConsentType(channel: MessagingChannel): string {
  return `${CONSENT_TYPE_PREFIX}${channel}`;
}

function isMessagingChannel(value: string): value is MessagingChannel {
  return (MESSAGING_CHANNELS as readonly string[]).includes(value);
}

function stateFromGranted(granted: boolean | null | undefined): ChannelConsentState {
  if (granted === true) return "opted_in";
  if (granted === false) return "opted_out";
  return "unknown";
}

function emptyConsentMap(): Record<MessagingChannel, ChannelConsentState> {
  return Object.fromEntries(
    MESSAGING_CHANNELS.map((c) => [c, "unknown" as ChannelConsentState])
  ) as Record<MessagingChannel, ChannelConsentState>;
}

export type RecordChannelConsentInput = {
  clinicId: string;
  patientId: string;
  channel: MessagingChannel;
  granted: boolean;
  /** 'portal' | 'onboarding' | 'manual' | 'sms_keyword' | ... (livre, como em patient_consents.source) */
  source?: string;
  ip?: string | null;
  userAgent?: string | null;
  notes?: string | null;
};

/**
 * Registra um opt-in (granted=true) ou opt-out (granted=false) de um canal.
 * Guarda ip/user_agent/source como prova (TCPA/HIPAA). Nunca faz update: cada
 * decisao vira uma linha nova, preservando o historico.
 */
export async function recordChannelConsent(
  input: RecordChannelConsentInput,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? createSupabaseAdminClient();
  const { error } = await supabase.from("patient_consents").insert({
    clinic_id: input.clinicId,
    patient_id: input.patientId,
    consent_type: channelConsentType(input.channel),
    granted: input.granted,
    ip_address: input.ip ?? null,
    user_agent: input.userAgent ?? null,
    source: input.source ?? "manual",
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

/** Estado atual de UM canal para o paciente (linha mais recente). */
export async function getChannelConsent(
  patientId: string,
  channel: MessagingChannel,
  client?: SupabaseClient
): Promise<ChannelConsentState> {
  const supabase = client ?? createSupabaseAdminClient();
  const { data } = await supabase
    .from("patient_consents")
    .select("granted")
    .eq("patient_id", patientId)
    .eq("consent_type", channelConsentType(channel))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return stateFromGranted((data as { granted?: boolean } | null)?.granted);
}

/**
 * Estado atual de TODOS os canais para o paciente, em uma unica consulta.
 * Canais sem nenhum registro voltam como "unknown".
 */
export async function getPatientChannelConsents(
  patientId: string,
  client?: SupabaseClient
): Promise<Record<MessagingChannel, ChannelConsentState>> {
  const supabase = client ?? createSupabaseAdminClient();
  const { data } = await supabase
    .from("patient_consents")
    .select("consent_type, granted, created_at")
    .eq("patient_id", patientId)
    .like("consent_type", `${CONSENT_TYPE_PREFIX}%`)
    .order("created_at", { ascending: false });

  const result = emptyConsentMap();

  // Linhas vem em created_at DESC: a primeira vista de cada consent_type e a atual.
  const seen = new Set<string>();
  for (const row of (data ?? []) as Array<{ consent_type: string; granted: boolean }>) {
    if (seen.has(row.consent_type)) continue;
    seen.add(row.consent_type);
    const channel = row.consent_type.slice(CONSENT_TYPE_PREFIX.length);
    if (isMessagingChannel(channel)) {
      result[channel] = stateFromGranted(row.granted);
    }
  }
  return result;
}

/**
 * Versao em lote de getPatientChannelConsents: uma unica consulta para varios
 * pacientes (usado pelo dunning, que processa um lote de inadimplentes).
 * Pacientes sem nenhum registro voltam com todos os canais "unknown".
 */
export async function getChannelConsentsForPatients(
  patientIds: string[],
  client?: SupabaseClient
): Promise<Map<string, Record<MessagingChannel, ChannelConsentState>>> {
  const result = new Map<string, Record<MessagingChannel, ChannelConsentState>>();
  for (const id of patientIds) result.set(id, emptyConsentMap());
  if (patientIds.length === 0) return result;

  const supabase = client ?? createSupabaseAdminClient();
  const { data } = await supabase
    .from("patient_consents")
    .select("patient_id, consent_type, granted, created_at")
    .in("patient_id", patientIds)
    .like("consent_type", `${CONSENT_TYPE_PREFIX}%`)
    .order("created_at", { ascending: false });

  // Dedup por (patient_id, consent_type); linhas em DESC, a 1a vista e a atual.
  const seen = new Set<string>();
  for (const row of (data ?? []) as Array<{ patient_id: string; consent_type: string; granted: boolean }>) {
    const key = `${row.patient_id}|${row.consent_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const channel = row.consent_type.slice(CONSENT_TYPE_PREFIX.length);
    if (isMessagingChannel(channel)) {
      const rec = result.get(row.patient_id);
      if (rec) rec[channel] = stateFromGranted(row.granted);
    }
  }
  return result;
}

/**
 * Politica de mensagem TRANSACIONAL (ex.: aviso de falha de pagamento/dunning,
 * lembrete de consulta): pode enviar em qualquer canal que o paciente NAO tenha
 * feito opt-out explicito. Nao exige opt-in previo, porque bloquear "unknown"
 * silenciaria comunicacao de servico legitima enquanto a captura de opt-in por
 * canal ainda esta sendo distribuida. Para mensagem de MARKETING, use um
 * criterio estrito (state === "opted_in").
 */
export function canSendTransactional(state: ChannelConsentState): boolean {
  return state !== "opted_out";
}
