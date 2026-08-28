import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { bio3FromAnswerRows, type AnswerRow } from "@/modules/neuro-id/unified-form-result";
import type { MedicationComplexityInput } from "@/lib/medication-complexity";
import type { SafetyFlags } from "@/lib/safety-flags";
import { createLogger } from "@/lib/logger";

const log = createLogger("unified-form-bio3");

/**
 * Grava o Mapa Bio³ derivado do FORMULÁRIO UNIFICADO reusando as MESMAS tabelas
 * do fluxo atual (`patient_assessments` + `patient_assessment_values` +
 * `patient_neuro_id_scores`), com `source = 'unified_form'`. Um rascunho por
 * paciente (reaproveita o aberto). O motor continua o mesmo (`computeNeuroId`
 * dentro de `bio3FromAnswerRows`). Devolve o assessmentId e os sinais de segurança.
 */
export async function saveUnifiedFormResult(
  patientId: string,
  clinicId: string,
  answers: AnswerRow[],
  medInput?: MedicationComplexityInput,
): Promise<{ assessmentId: string; safety: SafetyFlags }> {
  const supabase = createSupabaseAdminClient();
  const out = bio3FromAnswerRows(answers, medInput);
  const result = out.neuro;

  const { data: existing } = await supabase
    .from("patient_assessments")
    .select("id")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .eq("source", "unified_form")
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
      .insert({ clinic_id: clinicId, patient_id: patientId, source: "unified_form", status: "auto_draft" })
      .select("id")
      .single();
    if (cErr) throw cErr;
    assessmentId = created.id as string;
  }

  const byCode = new Map(result.scoredItems.map((s) => [s.code, s.dysfunction]));
  const valueRows = Object.entries(out.bio3Values).map(([item_code, raw]) => ({
    assessment_id: assessmentId,
    item_code,
    raw_value: `unified:${raw}`,
    dysfunction_score: byCode.get(item_code) ?? null,
  }));
  if (valueRows.length > 0) {
    const { error: vErr } = await supabase.from("patient_assessment_values").insert(valueRows);
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
    is_partial: result.isPartial,
  });
  if (sErr) throw sErr;

  log.info("Bio³ do formulário unificado salvo", { patient_id: patientId, assessment_id: assessmentId });
  return { assessmentId, safety: out.safety };
}
