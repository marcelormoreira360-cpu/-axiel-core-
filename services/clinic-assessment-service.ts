/**
 * clinic-assessment-service.ts — Avaliação editável por clínica (migration 101).
 *
 * Cada clínica define os campos do painel "Avaliação" (espaço do terapeuta que
 * alimenta o relatório). As respostas do paciente ficam em patients.assessment_data
 * (JSONB, chave = field_key). RLS multi-tenant por clinic_id.
 *
 * Seed: clínicas existentes foram semeadas na migration; clínicas novas recebem os
 * campos padrão de forma preguiçosa no primeiro acesso (ensureClinicAssessmentFields,
 * via admin client + onConflict ignore — idempotente e imune a corrida).
 */
import type { ClinicAssessmentField, AssessmentFieldType, Patient } from "@/lib/types";

// ── Campos padrão (espelham o seed da migration 101) ─────────────────────────
export type DefaultFieldSeed = {
  field_key: string;
  label: string;
  field_type: AssessmentFieldType;
  placeholder: string | null;
  options: ClinicAssessmentField["options"];
  order_index: number;
  group_key: string;
  include_in_report: boolean;
};

/**
 * Colunas legadas da Avaliação que ainda existem em `patients` (compat/fallback).
 * Fonte única: usada pelo save (dual-write) e pelo relatório (fallback). Ver migration 101.
 */
export const LEGACY_ASSESSMENT_COLUMNS = [
  "anamnese",
  "antecedents",
  "pain_level",
  "pain_location",
  "treatment_note",
] as const;

// Ordem padrão: blocos ATM contíguos, com Anamnese (Mediadores) no topo. A clínica
// pode reordenar tudo em /settings/avaliacao (a ficha obedece o order_index).
export const DEFAULT_ASSESSMENT_FIELDS: DefaultFieldSeed[] = [
  { field_key: "anamnese", label: "Anamnese", field_type: "textarea", placeholder: "Como o paciente está, queixa, história de vida, hábitos...", options: null, order_index: 0, group_key: "mediadores", include_in_report: true },
  { field_key: "pain_level", label: "Grau da dor (0–10)", field_type: "number", placeholder: null, options: { min: 0, max: 10 }, order_index: 1, group_key: "mediadores", include_in_report: true },
  { field_key: "pain_location", label: "Local da dor", field_type: "text", placeholder: "Ex: torácica alta, lombar, ombro direito...", options: null, order_index: 2, group_key: "mediadores", include_in_report: true },
  { field_key: "antecedents", label: "Antecedentes / cirurgias", field_type: "textarea", placeholder: "Cirurgias, doenças prévias e histórico relevante (o que não vem dos questionários).", options: null, order_index: 3, group_key: "antecedentes", include_in_report: true },
  // Fase 2 (ATM): campos humanos de alto valor que o terapeuta preenche na consulta.
  { field_key: "linha_do_tempo", label: "Linha do tempo (gatilhos)", field_type: "textarea", placeholder: "Quando começou? O que aconteceu antes? (cirurgias, COVID, perdas, mudanças hormonais, estresse intenso)", options: null, order_index: 4, group_key: "gatilhos", include_in_report: true },
  { field_key: "objetivo", label: "Objetivo (3 prioridades)", field_type: "textarea", placeholder: "Se eu pudesse resolver 3 coisas na sua saúde, quais seriam?", options: null, order_index: 5, group_key: "objetivo", include_in_report: true },
  { field_key: "treatment_note", label: "Conduta / tratamento sugerido", field_type: "textarea", placeholder: "Tratamento realizado e a sugestão que vai no 1º relatório do paciente.", options: null, order_index: 6, group_key: "integracao", include_in_report: true },
  { field_key: "integracao_atm", label: "Integração clínica (ATM)", field_type: "textarea", placeholder: "Principais queixas, gatilhos, fatores que mantêm o quadro, sistemas mais desregulados, hipóteses a confirmar.", options: null, order_index: 7, group_key: "integracao", include_in_report: true },
];

/** Gera um field_key estável a partir de um rótulo (slug ASCII). */
export function slugifyFieldKey(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `campo_${Math.abs(hashString(label)) % 100000}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

// ── Seed preguiçoso (admin client, idempotente) ──────────────────────────────
export async function ensureClinicAssessmentFields(clinicId: string): Promise<void> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("clinic_assessment_fields")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);
  if ((count ?? 0) > 0) return;
  const rows = DEFAULT_ASSESSMENT_FIELDS.map((d) => ({ clinic_id: clinicId, ...d }));
  await admin
    .from("clinic_assessment_fields")
    .upsert(rows, { onConflict: "clinic_id,field_key", ignoreDuplicates: true });
}

// ── Leitura ──────────────────────────────────────────────────────────────────
export async function getClinicAssessmentFields(
  clinicId: string,
  opts?: { activeOnly?: boolean },
): Promise<ClinicAssessmentField[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const read = async () => {
    let query = supabase
      .from("clinic_assessment_fields")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("order_index", { ascending: true });
    if (opts?.activeOnly) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ClinicAssessmentField[];
  };

  let fields = await read();
  if (fields.length === 0) {
    // Clínica sem campos (criada após a migration): semeia e relê.
    await ensureClinicAssessmentFields(clinicId);
    fields = await read();
  }
  return fields;
}

// ── Escrita ────────────────────────────────────────────────────────────────
export async function createClinicAssessmentField(input: {
  clinic_id: string;
  label: string;
  field_type: AssessmentFieldType;
  placeholder?: string | null;
  help_text?: string | null;
  options?: ClinicAssessmentField["options"];
  group_key?: string;
  include_in_report?: boolean;
}): Promise<ClinicAssessmentField> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  // Próxima ordem + field_key único na clínica.
  const existing = await getClinicAssessmentFields(input.clinic_id);
  const nextOrder = existing.reduce((m, f) => Math.max(m, f.order_index), -1) + 1;
  const used = new Set(existing.map((f) => f.field_key));
  let key = slugifyFieldKey(input.label);
  if (used.has(key)) {
    let n = 2;
    while (used.has(`${key}_${n}`)) n++;
    key = `${key}_${n}`;
  }

  const { data, error } = await supabase
    .from("clinic_assessment_fields")
    .insert({
      clinic_id: input.clinic_id,
      field_key: key,
      label: input.label,
      field_type: input.field_type,
      placeholder: input.placeholder ?? null,
      help_text: input.help_text ?? null,
      options: input.options ?? null,
      order_index: nextOrder,
      group_key: input.group_key ?? "mediadores",
      include_in_report: input.include_in_report ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClinicAssessmentField;
}

export async function updateClinicAssessmentField(
  id: string,
  patch: Partial<Pick<ClinicAssessmentField, "label" | "field_type" | "placeholder" | "help_text" | "options" | "is_active" | "include_in_report" | "order_index" | "group_key">>,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("clinic_assessment_fields")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteClinicAssessmentField(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("clinic_assessment_fields").delete().eq("id", id);
  if (error) throw error;
}

/** Move um campo para cima/baixo trocando order_index com o vizinho. */
export async function moveClinicAssessmentField(
  clinicId: string,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const fields = await getClinicAssessmentFields(clinicId);
  const idx = fields.findIndex((f) => f.id === id);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= fields.length) return;
  const a = fields[idx];
  const b = fields[swapIdx];
  await Promise.all([
    updateClinicAssessmentField(a.id, { order_index: b.order_index }),
    updateClinicAssessmentField(b.id, { order_index: a.order_index }),
  ]);
}

// ── Helpers de leitura (painel + relatório) ──────────────────────────────────

/** Valor cru de um campo a partir do assessment_data do paciente. */
export function fieldValue(patient: Pick<Patient, "assessment_data">, key: string): string | number | null {
  const v = patient.assessment_data?.[key];
  return v === undefined ? null : v;
}

/**
 * Pares {label, value} para o relatório — só campos marcados include_in_report
 * com valor preenchido, na ordem configurada. Fonte única para o Doc 1.
 */
export function assessmentReportPairs(
  patient: Pick<Patient, "assessment_data">,
  fields: ClinicAssessmentField[],
): { key: string; label: string; value: string }[] {
  return fields
    .filter((f) => f.include_in_report)
    .map((f) => ({ key: f.field_key, label: f.label, value: fieldValue(patient, f.field_key) }))
    .filter((p) => p.value !== null && String(p.value).trim() !== "")
    .map((p) => ({ key: p.key, label: p.label, value: String(p.value).trim() }));
}
