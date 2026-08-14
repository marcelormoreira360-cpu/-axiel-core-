/**
 * Monta a config de APRESENTACAO da politica de no-show a partir das colunas de
 * public.clinics (taxa + razao social), num unico lugar reusavel pelos canais que
 * capturam o aceite fora do booking web: o link de confirmacao (app/confirmar) e a
 * voz (Vapi). Evita duplicar a leitura das colunas de taxa/entidade em cada canal.
 *
 * NAO cobra nada e NAO grava aceite: so LE a config e diz se a clinica cobra falta.
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { NoShowPolicyConfig } from "@/modules/no-show-policy/policy-text";

export type ClinicPolicyPresentation = {
  /** A clinica cobra falta/cancelamento tardio? (algum modo != 'none'.) */
  clinicCharges: boolean;
  /** Config pronta para getNoShowPolicyText (placeholders + omissao de clausula). */
  config: NoShowPolicyConfig;
};

// Forma bruta da linha lida. legal_entity_name (migration 144) ainda pode nao existir
// nos tipos gerados do Supabase; por isso lemos via cast, como o fee-decision-service.
type ClinicPolicyRow = {
  name: string | null;
  legal_entity_name: string | null;
  cancellation_window_hours: number | null;
  no_show_fee_mode: string | null;
  no_show_fee_percent: number | null;
  late_cancel_fee_mode: string | null;
  late_cancel_fee_percent: number | null;
};

/**
 * Le taxa + razao social da clinica e devolve {clinicCharges, config}. O nome legal
 * usa clinics.legal_entity_name com fallback em clinics.name (nunca nulo). Percentuais
 * ausentes viram null; janela ausente vira 24h (mesmo default do renderer).
 */
export async function getClinicPolicyPresentation(
  clinicId: string,
): Promise<ClinicPolicyPresentation> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("clinics")
    .select("name, legal_entity_name, cancellation_window_hours, no_show_fee_mode, no_show_fee_percent, late_cancel_fee_mode, late_cancel_fee_percent")
    .eq("id", clinicId)
    .maybeSingle();

  const row = (data ?? null) as ClinicPolicyRow | null;

  const noShowChargeable = (row?.no_show_fee_mode ?? "percent") !== "none";
  const lateChargeable = (row?.late_cancel_fee_mode ?? "percent") !== "none";
  const clinicName =
    (typeof row?.legal_entity_name === "string" && row.legal_entity_name.trim())
      ? row.legal_entity_name.trim()
      : (row?.name ?? null);

  return {
    clinicCharges: noShowChargeable || lateChargeable,
    config: {
      windowHours:
        typeof row?.cancellation_window_hours === "number" ? row.cancellation_window_hours : 24,
      latePct: typeof row?.late_cancel_fee_percent === "number" ? row.late_cancel_fee_percent : null,
      noShowPct: typeof row?.no_show_fee_percent === "number" ? row.no_show_fee_percent : null,
      lateChargeable,
      noShowChargeable,
      clinicName,
    },
  };
}
