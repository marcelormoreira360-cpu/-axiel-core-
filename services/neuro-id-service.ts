/**
 * neuro-id-service.ts — Mapa Bio³ (Índice Neuro ID).
 *
 * Catálogo por clínica (seed dos defaults), criação de avaliação + cálculo do
 * motor (modules/neuro-id/scoring) e leitura do mapa mais recente.
 * RLS multi-tenant: catálogo/avaliação por clinic_id; valores/scores via assessment_id.
 * Armazena DISFUNÇÃO (0–100); a conversão para EQUILÍBRIO é feita na exibição.
 */

import { DEFAULT_CATALOG, type NeuroPillar } from "@/modules/neuro-id/catalog";
import { computeNeuroId, asScorable, type ScorableItem, type NeuroIdResult } from "@/modules/neuro-id/scoring";
import { mergeConfirmedMetrics, EXAM_METRIC_META, type PillarContribution } from "@/modules/neuro-id/exam-metrics";
import { DEFAULT_QUESTION_MAP, QUESTIONNAIRE_LABELS, normalizeToDysfunction10, type QuestionMapEntry } from "@/modules/neuro-id/question-map";
import { formatFindingsSummary, type FindingGroup, type FindingItem } from "@/modules/neuro-id/findings";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Client genérico: server (sessão do usuário) por padrão, ou admin (ex.: gatilho
// no submit público do paciente, sem sessão — escopo de clínica explícito).
type Db = ReturnType<typeof createSupabaseAdminClient>;
async function getDb(client?: Db): Promise<Db> {
  if (client) return client;
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  return (await createSupabaseServerClient()) as unknown as Db;
}

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
  /** status da avaliação de origem: 'auto_draft' | 'draft' | 'final'. */
  status: string | null;
};

// ── Catálogo ─────────────────────────────────────────────────────────────────
export async function getNeuroIdCatalog(clinicId: string, client?: Db): Promise<CatalogRow[]> {
  const supabase = await getDb(client);
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
export async function ensureClinicCatalog(clinicId: string, client?: Db): Promise<CatalogRow[]> {
  const existing = await getNeuroIdCatalog(clinicId, client);
  if (existing.length > 0) return existing;

  const supabase = await getDb(client);
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

// ── Fusão de exames (gate humano): métricas CONFIRMADAS do paciente ───────────
// Lê os exames já revisados (metrics_reviewed_at != null) e funde os metrics_values
// num único { code: valor } (mais recente vence). Alimenta `examValues` do motor.
export async function confirmedExamMetrics(patientId: string, clinicId: string, client?: Db): Promise<Record<string, number>> {
  const supabase = await getDb(client);
  // clinic_id explícito além da RLS: o gatilho pós-submit usa o admin client
  // (RLS off), então o escopo multi-tenant precisa ser garantido aqui.
  // Ordena por exam_date e desempata por metrics_reviewed_at: a leitura mais
  // recente (e, em empate de data, a confirmada por último) vence em mergeConfirmedMetrics.
  const { data, error } = await supabase
    .from("patient_functional_exams")
    .select("metrics_values, exam_date, metrics_reviewed_at")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .not("metrics_reviewed_at", "is", null)
    .order("exam_date", { ascending: true })
    .order("metrics_reviewed_at", { ascending: true });
  if (error) throw error;
  return mergeConfirmedMetrics((data ?? []) as { metrics_values: Record<string, number> | null }[]);
}

// Linhas de patient_assessment_values para as métricas de exame fundidas, com a
// disfunção 0–100 do motor (rastreável; entram nos pontos de atenção). Origem `exam:`.
function examValueRows(
  assessmentId: string,
  examValues: Record<string, number>,
  examContributions: PillarContribution[],
): { assessment_id: string; item_code: string; raw_value: string; dysfunction_score: number | null }[] {
  const dysByCode = new Map<string, number>();
  for (const c of examContributions) dysByCode.set(c.code, c.dysfunction);
  return Object.entries(examValues).map(([item_code, v]) => ({
    assessment_id: assessmentId,
    item_code,
    raw_value: `exam:${v}`,
    dysfunction_score: dysByCode.get(item_code) ?? null,
  }));
}

// Linhas de patient_assessment_values: itens preenchidos (raw cru) + métricas de
// exame fundidas. Compartilhado por create/update para não divergirem.
function neuroIdValueRows(
  assessmentId: string,
  values: Record<string, string | number | null | undefined>,
  result: NeuroIdResult,
  examValues: Record<string, number>,
) {
  const byCode = new Map(result.scoredItems.map((s) => [s.code, s.dysfunction]));
  const valueRows = Object.entries(values)
    .filter(([, raw]) => raw !== null && raw !== undefined && String(raw).trim() !== "")
    .map(([item_code, raw]) => ({
      assessment_id: assessmentId,
      item_code,
      raw_value: String(raw),
      dysfunction_score: byCode.get(item_code) ?? null,
    }));
  return [...valueRows, ...examValueRows(assessmentId, examValues, result.examContributions)];
}

// Linha agregada de patient_neuro_id_scores.
function neuroIdScoresRow(
  assessmentId: string,
  patientId: string,
  result: NeuroIdResult,
  isPartial: boolean,
) {
  return {
    assessment_id: assessmentId,
    patient_id: patientId,
    fisico_pct: result.pillars.fisico.dysfunction,
    bioquimico_pct: result.pillars.bioquimico.dysfunction,
    emocional_pct: result.pillars.emocional.dysfunction,
    indice_geral: result.indiceGeral,
    priority_pillar: result.priorityPillar,
    is_partial: isPartial,
  };
}

// ── Leitura do mapa mais recente ──────────────────────────────────────────────
export async function getLatestNeuroIdMap(patientId: string, client?: Db): Promise<NeuroIdMap | null> {
  const supabase = await getDb(client);
  const { data, error } = await supabase
    .from("patient_neuro_id_scores")
    .select("assessment_id, patient_id, fisico_pct, bioquimico_pct, emocional_pct, indice_geral, priority_pillar, is_partial, computed_at, patient_assessments(status)")
    .eq("patient_id", patientId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const a = (data as { patient_assessments?: { status?: string } | { status?: string }[] | null }).patient_assessments;
  const status = (Array.isArray(a) ? a[0]?.status : a?.status) ?? null;
  return { ...(data as unknown as NeuroIdMap), status };
}

// ── Pontos de atenção: piores itens da última avaliação (barras, pior primeiro) ─
export type AttentionPoint = { code: string; label: string; dysfunction: number };

export async function getNeuroIdAttentionPoints(
  assessmentId: string,
  limit = 6,
  client?: Db,
): Promise<AttentionPoint[]> {
  const supabase = await getDb(client);
  const { data, error } = await supabase
    .from("patient_assessment_values")
    .select("item_code, dysfunction_score")
    .eq("assessment_id", assessmentId);
  if (error) throw error;
  const labelByCode = new Map(DEFAULT_CATALOG.map((d) => [d.code, d.label]));
  return ((data ?? []) as { item_code: string; dysfunction_score: number | null }[])
    .filter((r) => r.dysfunction_score != null && r.dysfunction_score > 0)
    .map((r) => ({
      code: r.item_code,
      label: labelByCode.get(r.item_code) ?? EXAM_METRIC_META[r.item_code]?.label ?? r.item_code,
      dysfunction: Math.round(r.dysfunction_score as number),
    }))
    .sort((a, b) => b.dysfunction - a.dysfunction)
    .slice(0, limit);
}

// ── Reabrir avaliação: valores crus por item (para rever/corrigir) ────────────
/**
 * Valores crus (raw) gravados numa avaliação, por item_code — para reabrir o
 * formulário e corrigir. Strips o prefixo "auto:" (usado pelos rascunhos
 * automáticos) e devolve quais codes vieram de questionário (autoCodes).
 */
export async function getAssessmentRawValues(
  assessmentId: string,
  client?: Db,
): Promise<{ values: Record<string, string>; autoCodes: string[] }> {
  const supabase = await getDb(client);
  const { data, error } = await supabase
    .from("patient_assessment_values")
    .select("item_code, raw_value")
    .eq("assessment_id", assessmentId);
  if (error) throw error;
  const values: Record<string, string> = {};
  const autoCodes: string[] = [];
  for (const r of (data ?? []) as { item_code: string; raw_value: string | null }[]) {
    let raw = r.raw_value == null ? "" : String(r.raw_value);
    // Métricas de exame (origem `exam:`) são re-fundidas pelo motor, não editáveis no form.
    if (raw.startsWith("exam:")) continue;
    if (raw.startsWith("auto:")) { autoCodes.push(r.item_code); raw = raw.slice("auto:".length); }
    if (raw.trim() !== "") values[r.item_code] = raw;
  }
  return { values, autoCodes };
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

  // IO independente em paralelo: catálogo da clínica + métricas de exame CONFIRMADAS.
  const [catalog, examValues] = await Promise.all([
    ensureClinicCatalog(input.clinicId),
    confirmedExamMetrics(input.patientId, input.clinicId),
  ]);
  const items = catalogToScorable(catalog);
  // Fusão: métricas de exame CONFIRMADAS entram na média ponderada por pilar.
  const result = computeNeuroId(items, input.values, examValues);

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

  // 2) valores (só os preenchidos), com a disfunção calculada + métricas de exame
  const allRows = neuroIdValueRows(assessmentId, input.values, result, examValues);
  if (allRows.length > 0) {
    const { error: vErr } = await supabase.from("patient_assessment_values").insert(allRows);
    if (vErr) throw vErr;
  }

  // 3) scores agregados
  const { error: sErr } = await supabase
    .from("patient_neuro_id_scores")
    .insert(neuroIdScoresRow(assessmentId, input.patientId, result, result.isPartial));
  if (sErr) throw sErr;

  // Finaliza qualquer rascunho automático aberto deste paciente (idempotência §3):
  // ao criar uma avaliação final, o auto_draft deixa de ser o rascunho ativo.
  await supabase
    .from("patient_assessments")
    .update({ status: "final", updated_at: new Date().toISOString() })
    .eq("patient_id", input.patientId)
    .eq("status", "auto_draft")
    .neq("id", assessmentId);

  return { assessmentId, result };
}

// ── Corrigir a MESMA avaliação (rever/editar, não cria nova) ──────────────────
/**
 * Recalcula e regrava os valores/scores de uma avaliação EXISTENTE — usado pelo
 * "Rever / editar" para corrigir pontuação sem criar uma reavaliação nova.
 * Preserva o status/origem da avaliação (correção ≠ reavaliação). Guard de
 * tenant: a avaliação precisa pertencer ao paciente/clínica.
 */
export async function updateNeuroIdAssessment(input: {
  assessmentId: string;
  clinicId: string;
  patientId: string;
  values: Record<string, string | number | null | undefined>;
}): Promise<{ assessmentId: string; result: NeuroIdResult }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  // Guard: a avaliação tem de pertencer a este paciente/clínica.
  const { data: existing, error: exErr } = await supabase
    .from("patient_assessments")
    .select("id, clinic_id, patient_id")
    .eq("id", input.assessmentId)
    .maybeSingle();
  if (exErr) throw exErr;
  if (!existing || existing.clinic_id !== input.clinicId || existing.patient_id !== input.patientId) {
    throw new Error("Avaliação não encontrada para este paciente/clínica.");
  }

  // IO independente em paralelo: catálogo da clínica + métricas de exame CONFIRMADAS.
  const [catalog, examValues] = await Promise.all([
    ensureClinicCatalog(input.clinicId),
    confirmedExamMetrics(input.patientId, input.clinicId),
  ]);
  const items = catalogToScorable(catalog);
  const result = computeNeuroId(items, input.values, examValues);

  // Regrava in-place: limpa valores+scores e reinsere (corrige a MESMA avaliação).
  // Promove para `final`: uma revisão/correção humana deixa de ser rascunho
  // automático e fica protegida do auto-gatilho (autoUpsertNeuroIdDraft), que
  // sobrescreveria um `auto_draft` ao chegar um novo questionário.
  await supabase.from("patient_assessment_values").delete().eq("assessment_id", input.assessmentId);
  await supabase.from("patient_neuro_id_scores").delete().eq("assessment_id", input.assessmentId);
  await supabase.from("patient_assessments").update({ status: "final", updated_at: new Date().toISOString() }).eq("id", input.assessmentId);

  const allRows = neuroIdValueRows(input.assessmentId, input.values, result, examValues);
  if (allRows.length > 0) {
    const { error: vErr } = await supabase.from("patient_assessment_values").insert(allRows);
    if (vErr) throw vErr;
  }

  const { error: sErr } = await supabase
    .from("patient_neuro_id_scores")
    .insert(neuroIdScoresRow(input.assessmentId, input.patientId, result, result.isPartial));
  if (sErr) throw sErr;

  return { assessmentId: input.assessmentId, result };
}

// ── §8: importar respostas de questionário → rascunho 0–10 (auto) ─────────────
export type QuestionMapRow = QuestionMapEntry & {
  id: string; clinic_id: string; norm_min?: number | null; norm_max?: number | null;
};

/** Garante o de-para default da clínica (idempotente). Requer contexto de escrita. */
export async function ensureClinicQuestionMap(clinicId: string, client?: Db): Promise<QuestionMapRow[]> {
  const supabase = await getDb(client);
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
  /** code → "raw/max" usado na normalização (ex.: "6/32") — hint de origem */
  origins: Record<string, string>;
  /** codes mapeados mas sem resposta (pendentes / CTA) */
  missing: string[];
  /** rótulos dos questionários que o paciente NÃO respondeu (ex.: "Q-SNA") */
  unanswered: string[];
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
  client?: Db,
): Promise<QuestionnaireImport> {
  const supabase = await getDb(client);

  const map = await ensureClinicQuestionMap(clinicId, client);

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

  // Questionários mapeados que o paciente NÃO respondeu (rótulo amigável, deduplicado).
  const unanswered = [
    ...new Set(
      [...new Set(map.map((m) => m.template_match))]
        .filter((m) => latestFor(m) === null)
        .map((m) => QUESTIONNAIRE_LABELS[m] ?? m),
    ),
  ].sort();

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
  const origins: Record<string, string> = {};
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
    const effMax = row.norm_max != null ? row.norm_max : max;
    const norm = normalizeToDysfunction10(raw, effMax);
    if (norm === null) { if (!missing.includes(row.catalog_code)) missing.push(row.catalog_code); continue; }
    draft[row.catalog_code] = norm;
    sources[row.catalog_code] = tplName(resp);
    if (raw != null && effMax != null) origins[row.catalog_code] = `${raw}/${effMax}`;
  }

  // Alerta PHQ-9 item 9 (ideação) — não silenciar.
  let phq9Item9: { value: number } | null = null;
  const phq9 = latestFor("PHQ-9");
  if (phq9) {
    const agg = await aggregate(phq9);
    if (agg.item9 !== null && agg.item9 > 0) phq9Item9 = { value: agg.item9 };
  }

  return { draft, sources, origins, missing, unanswered, phq9Item9 };
}

// ── Auto-gerar Mapa Bio³ ao responder questionário (gatilho pós-submit) ───────
// Idempotente: mantém UM rascunho `auto_draft` por paciente até finalizar.
// `is_partial=true` sempre (falta o Biomecânico/exame físico). Silencioso quando
// o template não está mapeado (draft vazio) → não gera nem quebra.
export async function autoUpsertNeuroIdDraft(
  patientId: string,
  clinicId: string,
  client?: Db,
): Promise<{ assessmentId: string } | null> {
  const supabase = await getDb(client);

  const imp = await importQuestionnaireAnswers(patientId, clinicId, client);
  if (Object.keys(imp.draft).length === 0) return null; // nada mapeado/respondido

  // IO independente em paralelo: catálogo + métricas de exame já confirmadas (gate).
  const [catalog, examValues] = await Promise.all([
    ensureClinicCatalog(clinicId, client),
    confirmedExamMetrics(patientId, clinicId, client),
  ]);
  const items = catalogToScorable(catalog);
  // Fusão: inclui as métricas de exame confirmadas na pirâmide parcial.
  const result = computeNeuroId(items, imp.draft, examValues);

  // Um rascunho auto por paciente: reaproveita o aberto (atualiza) ou cria.
  const { data: existing } = await supabase
    .from("patient_assessments")
    .select("id")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .eq("status", "auto_draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let assessmentId: string;
  if (existing?.id) {
    assessmentId = existing.id as string;
    await supabase.from("patient_assessment_values").delete().eq("assessment_id", assessmentId);
    await supabase.from("patient_neuro_id_scores").delete().eq("assessment_id", assessmentId);
    await supabase.from("patient_assessments").update({ updated_at: new Date().toISOString() }).eq("id", assessmentId);
  } else {
    const { data: created, error: cErr } = await supabase
      .from("patient_assessments")
      .insert({ clinic_id: clinicId, patient_id: patientId, source: "questionnaire", status: "auto_draft" })
      .select("id")
      .single();
    if (cErr) throw cErr;
    assessmentId = created.id as string;
  }

  const byCode = new Map(result.scoredItems.map((s) => [s.code, s.dysfunction]));
  const valueRows = Object.entries(imp.draft).map(([item_code, raw]) => ({
    assessment_id: assessmentId,
    item_code,
    raw_value: `auto:${raw}`,
    dysfunction_score: byCode.get(item_code) ?? null,
  }));
  const allRows = [...valueRows, ...examValueRows(assessmentId, examValues, result.examContributions)];
  if (allRows.length > 0) {
    const { error: vErr } = await supabase.from("patient_assessment_values").insert(allRows);
    if (vErr) throw vErr;
  }

  const { error: sErr } = await supabase.from("patient_neuro_id_scores").insert({
    assessment_id: assessmentId,
    patient_id: patientId,
    fisico_pct: result.pillars.fisico.dysfunction,
    bioquimico_pct: result.pillars.bioquimico.dysfunction,
    emocional_pct: result.pillars.emocional.dysfunction,
    indice_geral: result.indiceGeral,
    priority_pillar: result.priorityPillar,
    is_partial: true, // rascunho automático: falta o Biomecânico → sempre parcial
  });
  if (sErr) throw sErr;

  return { assessmentId };
}

// ── Achados dos questionários (QRM/Q-SNA) → texto para a Anamnese ──────────────
// Itens com pontuação >= corte (default 3), por seção, do QRM e do Q-SNA mais
// recentes. Devolve um resumo em texto para o terapeuta revisar/validar na
// Avaliação (depois alimenta o Doc 1). NÃO grava nada; pontuações Bio³ intactas.
export type QuestionnaireFindings = { text: string; hasData: boolean };

export async function extractQuestionnaireFindings(
  patientId: string,
  clinicId: string,
  threshold = 3,
  client?: Db,
): Promise<QuestionnaireFindings> {
  const supabase = await getDb(client);

  const instruments: { match: string; label: string; kind: "qrm" | "qsna" }[] = [
    { match: "Rastreamento Metab", label: "QRM (Rastreamento Metabólico)", kind: "qrm" },
    { match: "Q-SNA", label: "Q-SNA (Sistema Nervoso Autônomo)", kind: "qsna" },
  ];

  const groups: FindingGroup[] = [];

  for (const inst of instruments) {
    const { data: resp } = await supabase
      .from("assessment_responses")
      .select("id, template_id, total_score, max_possible_score, assessment_templates!inner(name)")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .ilike("assessment_templates.name", `%${inst.match}%`)
      .order("filled_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!resp) continue;

    const r = resp as unknown as { id: string; template_id: string; total_score: number | null; max_possible_score: number | null };

    const [{ data: answers }, { data: sections }] = await Promise.all([
      supabase
        .from("assessment_answers")
        .select("value_number, section_id, assessment_questions(text, order_index)")
        .eq("response_id", r.id)
        .gte("value_number", threshold),
      supabase.from("assessment_sections").select("id, title, order_index").eq("template_id", r.template_id),
    ]);

    const meta = new Map<string, { title: string; order: number }>();
    for (const s of sections ?? []) meta.set(s.id as string, { title: (s.title as string) ?? "", order: (s.order_index as number) ?? 0 });

    const items: (FindingItem & { secOrder: number; qOrder: number })[] = [];
    for (const a of answers ?? []) {
      const q = Array.isArray(a.assessment_questions) ? a.assessment_questions[0] : a.assessment_questions;
      // PostgREST serializa numeric como string → coage para número.
      const val = a.value_number == null ? null : Number(a.value_number);
      if (val === null || !Number.isFinite(val)) continue;
      const sec = meta.get(a.section_id as string);
      items.push({
        section: sec?.title ?? "",
        text: (q?.text as string) ?? "",
        value: val,
        secOrder: sec?.order ?? 0,
        qOrder: (q?.order_index as number) ?? 0,
      });
    }

    if (items.length === 0) continue;
    items.sort((x, y) => x.secOrder - y.secOrder || y.value - x.value || x.qOrder - y.qOrder);

    groups.push({
      instrument: inst.label,
      kind: inst.kind,
      total: r.total_score,
      max: r.max_possible_score,
      items: items.map(({ section, text, value }) => ({ section, text, value })),
    });
  }

  const text = formatFindingsSummary(groups, threshold);
  return { text, hasData: text.length > 0 };
}
