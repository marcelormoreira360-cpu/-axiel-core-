import type { AiInsightOutput, NeuroMapaIntegrativo, NeuroPlanoRegulacao } from "@/lib/types";
import { scanPatientText, summarizeViolations } from "@/modules/ai-insights/patient-text-guardrails";
import { getAiInsightById, updateAiInsightFinalOutput } from "@/services/ai-insight/insight-repository";

/**
 * Edição MANUAL do Doc 1 / Doc 2 pelo revisor, antes de aprovar/enviar.
 * Faz merge das seções editadas sobre o output atual (final_output ?? output),
 * roda o guardrail de texto ao paciente (sem BLOQUEAR — o revisor decide) e grava
 * em final_output. A aprovação posterior usa final_output, então o envio leva o
 * texto do humano. Devolve uma nota de guardrail quando algo merece atenção.
 */
export async function saveAiInsightEdits(input: {
  aiInsightId: string;
  editedMapa?: Partial<NeuroMapaIntegrativo> | null;
  editedPlano?: Partial<NeuroPlanoRegulacao> | null;
}): Promise<{ guardrailNote: string | null }> {
  const insight = await getAiInsightById(input.aiInsightId);
  if (!insight) throw new Error("Insight não encontrado.");

  const base = (insight.final_output ?? insight.output) as AiInsightOutput;
  const merged: AiInsightOutput = {
    ...base,
    mapa_integrativo: input.editedMapa
      ? { ...(base.mapa_integrativo ?? {}), ...input.editedMapa }
      : base.mapa_integrativo,
    plano_regulacao: input.editedPlano
      ? { ...(base.plano_regulacao ?? {}), ...input.editedPlano }
      : base.plano_regulacao,
  };

  const scan = scanPatientText(merged);
  const guardrailNote = scan.ok ? null : summarizeViolations(scan.violations);

  await updateAiInsightFinalOutput({ id: input.aiInsightId, final_output: merged });
  return { guardrailNote };
}
