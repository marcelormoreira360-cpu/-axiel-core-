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
import { DEFAULT_QUESTION_MAP, normalizeToDysfunction10, type QuestionMapEntry } from "@/modules/neuro-id/question-map";

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

// ── §8: importar respostas de questionário → rascunho 0–10 (auto) ─────────────
export type QuestionMapRow = QuestionMapEntry & {
  id: string; clinic_id: string; norm_min?: number | null; norm_max?: number | null;
};

/** Garante o de-para default da clínica (idempotente). Requer contexto de escrita. */
export async function ensureClinicQuestionMap(clinicId: string): Promise<QuestionMapRow[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase
    .from("neuro_id_question_map")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true);
  if (error) throw error;
  if ((existing ?? []).length > 0) return existing as QuestionMapRow[];

  const rows = DEFAULT_QUESTION_MAP.map((m) => ({
    clinic_id: clinicId,
    source: m.source,
    template_match: m.template_match,
    section_match: m.section_match,
    catalog_code: m.catalog_code,
    weight: m.weight ?? 1,
    active: true,
  }));
  const { error: insErr } = await supabase.from("neuro_id_question_map").insert(rows);
  if (insErr) throw insErr;
  const { data: seeded } = await supabase
    .from("neuro_id_question_map").select("*").eq("clinic_id", clinicId).eq("active", true);
  return (seeded ?? []) as QuestionMapRow[];
}

export type QuestionnaireImport = {
  /** code → disfunção 0–10 (rascunho para revisão) */
  draft: Record<string, number>;
  /** code → nome do questionário de origem */
  sources: Record<string, string>;
  /** codes mapeados mas sem resposta (pendentes / CTA) */
  missing: string[];
  /** Alerta clínico: PHQ-9 item 9 (ideação) > 0 — não silenciar. */
  phq9Item9: { value: number } | null;
};

type RespRow = {
  id: string;
  template_id: string;
  total_score: number | null;
  max_possible_score: number | null;
  filled_at: string;
  assessment_templates: { name?: string } | { name?: string }[] | null;
};

function tplName(r: RespRow): string {
  const t = Array.isArray(r.assessment_templates) ? r.assessment_templates[0] : r.assessment_templates;
  return t?.name ?? "";
}

/**
 * Lê as respostas mais recentes do paciente, aplica o de-para da clínica e
 * normaliza para disfunção 0–10. NÃO grava — devolve rascunho para revisão.
 */
export async function importQuestionnaireAnswers(
  patientId: string,
  clinicId: string,
): Promise<QuestionnaireImport> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const map = await ensureClinicQuestionMap(clinicId);

  // Respostas do paciente (mais recente primeiro) + nome do template.
  const { data: respsRaw, error: respErr } = await supabase
    .from("assessment_responses")
    .select("id, template_id, total_score, max_possible_score, filled_at, assessment_templates(name)")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .order("filled_at", { ascending: false });
  if (respErr) throw respErr;
  const resps = (respsRaw ?? []) as RespRow[];

  // Resposta mais recente cujo nome do template contém o match (case-insensitive).
  const latestFor = (match: string): RespRow | null =>
    resps.find((r) => tplName(r).toLowerCase().includes(match.toLowerCase())) ?? null;

  // Cache de agregados por response: sectionSums[title] = {raw,max}, total, item9.
  type Agg = {
    sections: Record<string, { raw: number; max: number }>;
    totalRaw: number; totalMax: number;
    item9: number | null;
  };
  const aggCache = new Map<string, Agg>();

  async function aggregate(resp: RespRow): Promise<Agg> {
    const cached = aggCache.get(resp.id);
    if (cached) return cached;
    const [{ data: answers }, { data: sections }] = await Promise.all([
      supabase
        .from("assessment_answers")
        .select("value_number, section_id, assessment_questions(max_score, order_index)")
        .eq("response_id", resp.id),
      supabase.from("assessment_sections").select("id, title").eq("template_id", resp.template_id),
    ]);
    const titleById = new Map<string, string>();
    for (const s of sections ?? []) titleById.set(s.id as string, (s.title as string) ?? "");

    const agg: Agg = { sections: {}, totalRaw: 0, totalMax: 0, item9: null };
    for (const a of answers ?? []) {
      const q = Array.isArray(a.assessment_questions) ? a.assessment_questions[0] : a.assessment_questions;
      const val = a.value_number as number | null;
      const max = (q?.max_score as number | null) ?? null;
      if (val === null || val === undefined || max === null) continue;
      agg.totalRaw += val;
      agg.totalMax += max;
      const title = titleById.get(a.section_id as string) ?? "";
      const bucket = (agg.sections[title] ??= { raw: 0, max: 0 });
      bucket.raw += val;
      bucket.max += max;
      if ((q?.order_index as number | null) === 8) agg.item9 = val; // 9ª pergunta (PHQ-9)
    }
    aggCache.set(resp.id, agg);
    return agg;
  }

  const draft: Record<string, number> = {};
  const sources: Record<string, string> = {};
  const missing: string[] = [];

  for (const row of map) {
    const resp = latestFor(row.template_match);
    if (!resp) { missing.push(row.catalog_code); continue; }
    const agg = await aggregate(resp);

    let raw: number | null = null;
    let max: number | null = null;
    if (row.section_match) {
      const key = Object.keys(agg.sections).find((tt) => tt.toLowerCase().includes(row.section_match!.toLowerCase()));
      if (key) { raw = agg.sections[key].raw; max = agg.sections[key].max; }
    } else {
      raw = resp.total_score ?? agg.totalRaw;
      max = resp.max_possible_score ?? agg.totalMax;
    }
    const norm = row.norm_max != null ? normalizeToDysfunction10(raw, row.norm_max) : normalizeToDysfunction10(raw, max);
    if (norm === null) { if (!missing.includes(row.catalog_code)) missing.push(row.catalog_code); continue; }
    draft[row.catalog_code] = norm;
    sources[row.catalog_code] = tplName(resp);
  }

  // Alerta PHQ-9 item 9 (ideação) — não silenciar.
  let phq9Item9: { value: number } | null = null;
  const phq9 = latestFor("PHQ-9");
  if (phq9) {
    const agg = await aggregate(phq9);
    if (agg.item9 !== null && agg.item9 > 0) phq9Item9 = { value: agg.item9 };
  }

  return { draft, sources, missing, phq9Item9 };
}
