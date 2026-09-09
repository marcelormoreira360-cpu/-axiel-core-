import type { AiInsight } from "@/lib/types";
import { toAppError } from "@/lib/errors";
import { reportModel } from "@/lib/ai-models";
import { writeAuditLog } from "@/services/audit-service";
import { buildAiInsightInput } from "@/services/ai-insight/input-builder";
import { generateAiInsightOutput } from "@/services/ai-insight/generation";
import {
  createAiRequest,
  completeAiRequest,
  saveAiInsight,
  getLatestFinalAiInsight,
} from "@/services/ai-insight/insight-repository";
import { scanPatientText, summarizeViolations } from "@/modules/ai-insights/patient-text-guardrails";
import { mergeRegeneratedSupplement } from "@/services/ai-insight/supplement-merge";

// Re-exporta o merge puro (definido em supplement-merge.ts, sem deps de servidor)
// para quem já importa deste módulo.
export { mergeRegeneratedSupplement };

/**
 * Regenera a suplementação de um paciente com o Protocolo dos 10 Filtros e salva
 * como RASCUNHO NOVO (pending_review), sem tocar em nenhum insight já aprovado.
 * O envio ao paciente continua manual, após aprovação humana (gate existente).
 *
 * Requer escopo de request (usa o client de servidor do repositório); será
 * chamada por uma server action / worker da fila (Fase 2).
 */
export async function regenerateSupplementForPatient(patientId: string): Promise<AiInsight> {
  const snapshot = await buildAiInsightInput(patientId, { includeDocuments: true });
  if (!snapshot) throw new Error("Patient not found.");

  const model = reportModel();
  const aiRequest = await createAiRequest({
    clinic_id: snapshot.patient.clinic_id,
    patient_id: patientId,
    model,
    input_summary: { kind: "supplement_regeneration", intake_count: snapshot.intake.length },
  });

  try {
    const { output: fresh, tokensUsed, modelUsed } = await generateAiInsightOutput(snapshot);

    // Se o fresco não trouxe suplementação (JSON malformado/vazio da OpenAI), é
    // uma regeneração falha: não salva rascunho nem apaga o Doc 2 aprovado.
    if (!fresh.protocolo_suplementacao) {
      throw new Error("A regeneração não produziu suplementação (Documento 2).");
    }

    await completeAiRequest({
      id: aiRequest.id,
      status: "completed",
      tokens_used: tokensUsed ?? null,
      output_summary: {
        kind: "supplement_regeneration",
        supplement_reasoning_version: fresh.supplement_reasoning_version ?? null,
        model_requested: model,
        model_used: modelUsed ?? null,
      },
    });

    // Documento 3 só existe com exame de cabelo real (mesma regra do fluxo principal).
    const hasHairTest = snapshot.functional_exams.some((e) =>
      /capilar|hipersensib|hair/i.test(`${e.type ?? ""} ${e.title ?? ""}`));
    if (!hasHairTest && fresh.relatorio_hipersensibilidade) delete fresh.relatorio_hipersensibilidade;

    // Preserva o Documento 1/3 aprovado (se houver) e troca só a suplementação.
    // Sem .catch: falha de leitura real deve PROPAGAR, não virar "sem aprovado"
    // (isso reescreveria o Doc 1 que o paciente já recebeu). null = não há aprovado.
    const previous = await getLatestFinalAiInsight(patientId);
    const previousOutput = previous ? (previous.final_output ?? previous.output) : null;
    const output = mergeRegeneratedSupplement(previousOutput, fresh);

    // Mesmo guardrail determinístico do fluxo principal sobre o texto ao paciente.
    const scan = scanPatientText(output);
    const guardrailNote = scan.ok ? null : summarizeViolations(scan.violations);

    return saveAiInsight({
      clinic_id: snapshot.patient.clinic_id,
      patient_id: patientId,
      ai_request_id: aiRequest.id,
      input_snapshot: snapshot,
      output,
      review_status: scan.ok ? "pending_review" : "needs_changes",
      guardrail_note: guardrailNote,
    });
  } catch (error) {
    // Não deixa ai_request pendurado em "pending": marca erro + audit (padrão do
    // generateAndSaveAiInsight). Aqui NÃO salvamos rascunho de fallback: uma
    // suplementação de fallback seria clinicamente pior que nenhuma.
    const safeError = toAppError(error, "Supplement regeneration is temporarily unavailable.");
    await completeAiRequest({
      id: aiRequest.id,
      status: "error",
      error_message: safeError.safeMessage,
      output_summary: { kind: "supplement_regeneration", error_kind: safeError.kind },
    });
    await writeAuditLog({
      clinicId: snapshot.patient.clinic_id,
      action: "ai_insight.supplement_regeneration_failed",
      entityType: "ai_request",
      entityId: aiRequest.id,
      metadata: { patient_id: patientId, error_kind: safeError.kind },
    });
    throw safeError;
  }
}
