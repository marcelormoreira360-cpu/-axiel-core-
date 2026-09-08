import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { bio3FromAnswerRows, type AnswerRow } from "@/modules/neuro-id/unified-form-result";
import type { MedicationComplexityInput } from "@/lib/medication-complexity";
import type { SafetyFlags } from "@/lib/safety-flags";
import { createLogger } from "@/lib/logger";

const log = createLogger("unified-form-bio3");

export type SaveUnifiedFormOptions = {
  medInput?: MedicationComplexityInput;
  /** Respostas cruas COMPLETAS (por código, inclusive texto/escolha) para o snapshot. */
  rawAnswers?: Record<string, unknown> | null;
  /** Template placeholder do formulário unificado — quando informado, grava também
   * um registro em `assessment_responses` (lista de Questionários + tela de detalhe). */
  templateId?: string | null;
};

/**
 * Grava o Mapa Bio³ derivado do FORMULÁRIO UNIFICADO reusando as MESMAS tabelas
 * do fluxo atual (`patient_assessments` + `patient_assessment_values` +
 * `patient_neuro_id_scores`), com `source = 'unified_form'`. Um rascunho por
 * paciente (reaproveita o aberto). O motor continua o mesmo (`computeNeuroId`
 * dentro de `bio3FromAnswerRows`). Devolve o assessmentId e os sinais de segurança.
 *
 * Quando `opts.rawAnswers` + `opts.templateId` são informados, grava TAMBÉM um
 * registro em `assessment_responses` com o snapshot completo das respostas — assim
 * nada de texto/escolha é perdido, o questionário aparece na seção "Questionários"
 * e a tela de detalhe consegue exibir as respostas.
 */
export async function saveUnifiedFormResult(
  patientId: string,
  clinicId: string,
  answers: AnswerRow[],
  opts?: SaveUnifiedFormOptions,
): Promise<{ assessmentId: string; safety: SafetyFlags }> {
  const supabase = createSupabaseAdminClient();
  const out = bio3FromAnswerRows(answers, opts?.medInput);
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

  // Snapshot em assessment_responses (lista de Questionários + tela de detalhe +
  // preservação das respostas de texto/escolha). Best-effort: uma falha aqui não
  // pode derrubar o Mapa Bio³ já gravado, mas é logada (a perda de dados era o bug).
  if (opts?.templateId && opts?.rawAnswers) {
    try {
      const round0 = (v: number | null) => (v == null ? 0 : Math.round(v));
      const sectionScores = {
        fisico: { title: "Corpo e movimento (físico)", score: round0(result.pillars.fisico.dysfunction), max: 100 },
        bioquimico: { title: "Regulação e sistêmico (biofuncional)", score: round0(result.pillars.bioquimico.dysfunction), max: 100 },
        emocional: { title: "Como você tem se sentido (emocional)", score: round0(result.pillars.emocional.dysfunction), max: 100 },
      };
      const { error: rErr } = await supabase.from("assessment_responses").insert({
        template_id: opts.templateId,
        patient_id: patientId,
        clinic_id: clinicId,
        total_score: round0(result.indiceGeral),
        max_possible_score: 100,
        score_percentage: result.indiceGeral,
        section_scores: sectionScores,
        raw_answers: opts.rawAnswers,
        notes: out.safety.crisis
          ? "Sinal de encaminhamento de apoio registrado nas respostas (revisão humana)."
          : null,
      });
      if (rErr) throw rErr;
    } catch (e) {
      log.warn("snapshot em assessment_responses (unificado) falhou", {
        patient_id: patientId,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { assessmentId, safety: out.safety };
}
