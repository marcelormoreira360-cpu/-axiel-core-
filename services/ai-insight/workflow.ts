import { toAppError } from "@/lib/errors";
import type { AiInsight } from "@/lib/types";
import { reportModel } from "@/lib/ai-models";
import { writeAuditLog } from "@/services/audit-service";
import { buildAiInsightInput } from "@/services/ai-insight/input-builder";
import { buildAiFallbackOutput, generateAiInsightOutput } from "@/services/ai-insight/generation";
import { completeAiRequest, createAiRequest, saveAiInsight } from "@/services/ai-insight/insight-repository";
import { hasPersuasiveDoc1, scanPatientText, summarizeViolations } from "@/modules/ai-insights/patient-text-guardrails";

export async function generateAndSaveAiInsight(patientId: string): Promise<AiInsight> {
  const snapshot = await buildAiInsightInput(patientId, { includeDocuments: true });
  if (!snapshot) throw new Error("Patient not found.");

  const model = reportModel();
  const aiRequest = await createAiRequest({
    clinic_id: snapshot.patient.clinic_id,
    patient_id: patientId,
    model,
    input_summary: {
      intake_count: snapshot.intake.length,
      session_notes_count: snapshot.session_notes.length,
      patient_history_count: snapshot.patient_history.length,
    },
  });

  try {
    let { output, tokensUsed, modelUsed } = await generateAiInsightOutput(snapshot);

    // O Documento 1 (mapa_integrativo + plano_regulacao) É o relatório que vai ao
    // paciente. O modelo de raciocínio às vezes devolve só o structured_summary
    // legado, sem o Doc 1 persuasivo, e o insight nasce "sem relatório" (o card
    // fica só com o resumo, e o PDF cai no fallback por scores). Antes de aceitar,
    // tenta gerar UMA vez mais; se a segunda também não trouxer o Doc 1, o insight
    // é sinalizado abaixo (needs_changes) com nota, nunca salvo em silêncio.
    if (!hasPersuasiveDoc1(output.mapa_integrativo)) {
      const retry = await generateAiInsightOutput(snapshot);
      if (hasPersuasiveDoc1(retry.output.mapa_integrativo)) {
        output = retry.output;
        tokensUsed = retry.tokensUsed;
        modelUsed = retry.modelUsed;
      }
    }
    const doc1Missing = !hasPersuasiveDoc1(output.mapa_integrativo);

    await completeAiRequest({
      id: aiRequest.id,
      status: "completed",
      tokens_used: tokensUsed ?? null,
      output_summary: {
        label: output.label,
        patterns_count: output.patterns_and_correlations.length,
        review_points_count: output.practitioner_review_points.length,
        // Modelo REAL usado (vs. `model` solicitado gravado no create): detecta
        // troca silenciosa de snapshot pela OpenAI ou env divergente.
        model_requested: model,
        model_used: modelUsed ?? null,
      },
    });

    // Documento 3 (Hipersensibilidade) só existe com exame de cabelo REAL. Se o
    // snapshot não tem exame funcional do tipo teste capilar/hipersensibilidade,
    // remove o campo — barra a IA de "preencher" o documento sem dado de origem.
    const hasHairTest = snapshot.functional_exams.some((e) =>
      /capilar|hipersensib|hair/i.test(`${e.type ?? ""} ${e.title ?? ""}`));
    if (!hasHairTest && output.relatorio_hipersensibilidade) {
      delete output.relatorio_hipersensibilidade;
    }

    // Guardrail determinístico sobre o texto ao PACIENTE (formato persuasivo Rota A):
    // se vazar jargão interno (exame/neurometria), número de sessões, travessão, ou
    // faltar âncora positiva, o insight NASCE em needs_changes p/ o gate humano revisar.
    // Nunca reescreve escondido; só sinaliza. Campos antigos (educativos) não são varridos.
    const scan = scanPatientText(output);
    const notes: string[] = [];
    if (doc1Missing) notes.push("Documento 1 (relatório ao paciente) não foi gerado; clique em \"Novo rascunho\" para gerar de novo.");
    if (!scan.ok) notes.push(summarizeViolations(scan.violations));
    const guardrailNote = notes.length ? notes.join(" · ") : null;

    return saveAiInsight({
      clinic_id: snapshot.patient.clinic_id,
      patient_id: patientId,
      ai_request_id: aiRequest.id,
      input_snapshot: snapshot,
      output,
      // Doc 1 ausente também barra o "pending_review": o insight sem relatório
      // precisa de atenção do terapeuta (regenerar) antes de qualquer envio.
      review_status: scan.ok && !doc1Missing ? "pending_review" : "needs_changes",
      guardrail_note: guardrailNote,
    });
  } catch (error) {
    const safeError = toAppError(error, "AI insights are temporarily unavailable.");
    const fallbackOutput = buildAiFallbackOutput(safeError.safeMessage);

    await completeAiRequest({
      id: aiRequest.id,
      status: "error",
      error_message: safeError.safeMessage,
      fallback_used: true,
      output_summary: { fallback: true, reason: safeError.kind },
    });

    await writeAuditLog({
      clinicId: snapshot.patient.clinic_id,
      action: "ai_insight.fallback_used",
      entityType: "ai_request",
      entityId: aiRequest.id,
      metadata: { patient_id: patientId, error_kind: safeError.kind },
    });

    return saveAiInsight({
      clinic_id: snapshot.patient.clinic_id,
      patient_id: patientId,
      ai_request_id: aiRequest.id,
      input_snapshot: snapshot,
      output: fallbackOutput,
    });
  }
}
