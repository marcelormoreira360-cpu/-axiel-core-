/**
 * neuro-id-service.ts — Mapa Bio³ (Índice Neuro ID).
 *
 * Catálogo por clínica (seed dos defaults), criação de avaliação + cálculo do
 * motor (modules/neuro-id/scoring) e leitura do mapa mais recente.
 * RLS multi-tenant: catálogo/avaliação por clinic_id; valores/scores via assessment_id.
 * Armazena DISFUNÇÃO (0–100); a conversão para EQUILÍBRIO é feita na exibição.
 */

import OpenAI from "openai";
import { DEFAULT_CATALOG, type NeuroPillar } from "@/modules/neuro-id/catalog";
import { computeNeuroId, asScorable, type ScorableItem, type NeuroIdResult } from "@/modules/neuro-id/scoring";
import { SEGMENT_SYSTEM_PROMPT, coerceSegmentDraft, type SegmentDraft } from "@/modules/neuro-id/segment-instruments";

export type CatalogRow = {
  id: string;
  clinic_id: string;
  code: string;
  label: string;
  pillar: NeuroPillar;
  direction: "higher_worse" | "higher_better";
  input_type: "scale_0_10" | "boolean" | "choice" | "lab" | "med";
  scoring_rule: Record<string, unknown>;
  weight: number;
  sort_order: number;
  active: boolean;
};

export type NeuroIdMap = {
  assessment_id: string;
  patient_id: string;
  fisico_pct: number | null;
  bioquimico_pct: number | null;
  emocional_pct: number | null;
  indice_geral: number | null;
  priority_pillar: NeuroPillar | null;
  is_partial: boolean;
  computed_at: string;
};

// ── Catálogo ─────────────────────────────────────────────────────────────────
export async function getNeuroIdCatalog(clinicId: string): Promise<CatalogRow[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assessment_items_catalog")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CatalogRow[];
}

/** Garante o catálogo default para a clínica (idempotente). Requer contexto de escrita. */
export async function ensureClinicCatalog(clinicId: string): Promise<CatalogRow[]> {
  const existing = await getNeuroIdCatalog(clinicId);
  if (existing.length > 0) return existing;

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const rows = DEFAULT_CATALOG.map((d) => ({
    clinic_id: clinicId,
    code: d.code,
    label: d.label,
    pillar: d.pillar,
    direction: d.direction,
    input_type: d.input_type,
    scoring_rule: d.scoring_rule,
    weight: d.weight,
    sort_order: d.sort_order,
    active: true,
  }));
  const { error } = await supabase.from("assessment_items_catalog").insert(rows);
  if (error) throw error;
  return getNeuroIdCatalog(clinicId);
}

/** Itens para o motor: catálogo da clínica se houver, senão os defaults. */
export function catalogToScorable(rows: CatalogRow[]): ScorableItem[] {
  if (rows.length === 0) return asScorable(DEFAULT_CATALOG);
  return rows.map((r) => ({
    code: r.code, pillar: r.pillar, direction: r.direction,
    input_type: r.input_type, scoring_rule: (r.scoring_rule ?? {}) as ScorableItem["scoring_rule"], weight: r.weight,
    partial: DEFAULT_CATALOG.find((d) => d.code === r.code)?.partial,
  }));
}

// ── Leitura do mapa mais recente ──────────────────────────────────────────────
export async function getLatestNeuroIdMap(patientId: string): Promise<NeuroIdMap | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_neuro_id_scores")
    .select("assessment_id, patient_id, fisico_pct, bioquimico_pct, emocional_pct, indice_geral, priority_pillar, is_partial, computed_at")
    .eq("patient_id", patientId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as NeuroIdMap | null;
}

// ── Criar avaliação + calcular + gravar scores ────────────────────────────────
export async function createNeuroIdAssessment(input: {
  clinicId: string;
  patientId: string;
  createdBy?: string | null;
  values: Record<string, string | number | null | undefined>;
}): Promise<{ assessmentId: string; result: NeuroIdResult }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const catalog = await ensureClinicCatalog(input.clinicId);
  const items = catalogToScorable(catalog);
  const result = computeNeuroId(items, input.values);

  // 1) avaliação
  const { data: assessment, error: aErr } = await supabase
    .from("patient_assessments")
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      source: "manual",
      status: "final",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (aErr) throw aErr;
  const assessmentId = assessment.id as string;

  // 2) valores (só os preenchidos), com a disfunção calculada
  const byCode = new Map(result.scoredItems.map((s) => [s.code, s.dysfunction]));
  const valueRows = Object.entries(input.values)
    .filter(([, raw]) => raw !== null && raw !== undefined && String(raw).trim() !== "")
    .map(([item_code, raw]) => ({
      assessment_id: assessmentId,
      item_code,
      raw_value: String(raw),
      dysfunction_score: byCode.get(item_code) ?? null,
    }));
  if (valueRows.length > 0) {
    const { error: vErr } = await supabase.from("patient_assessment_values").insert(valueRows);
    if (vErr) throw vErr;
  }

  // 3) scores agregados
  const { error: sErr } = await supabase.from("patient_neuro_id_scores").insert({
    assessment_id: assessmentId,
    patient_id: input.patientId,
    fisico_pct: result.pillars.fisico.dysfunction,
    bioquimico_pct: result.pillars.bioquimico.dysfunction,
    emocional_pct: result.pillars.emocional.dysfunction,
    indice_geral: result.indiceGeral,
    priority_pillar: result.priorityPillar,
    is_partial: result.isPartial,
  });
  if (sErr) throw sErr;

  return { assessmentId, result };
}

// ── IA segmentadora (Fase 2): extrai sub-scores do QRM/Q-SNA → rascunho 0–10 ──
// Guarda-corpo: a IA só extrai números do documento (não inventa); o humano
// revisa o rascunho antes de o motor calcular.
export async function segmentInstruments(input: {
  qrmText?: string;
  qsnaText?: string;
}): Promise<SegmentDraft> {
  const qrm = (input.qrmText ?? "").trim();
  const qsna = (input.qsnaText ?? "").trim();
  if (!qrm && !qsna) return {};
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ausente. Configure antes de usar a extração por IA.");
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SEGMENT_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ qrm_document: qrm || null, qsna_document: qsna || null }) },
    ],
  });
  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  return coerceSegmentDraft(parsed);
}
