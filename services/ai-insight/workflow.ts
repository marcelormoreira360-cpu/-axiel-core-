import { toAppError } from "@/lib/errors";
import type { AiInsight } from "@/lib/types";
import { writeAuditLog } from "@/services/audit-service";
import { buildAiInsightInput } from "@/services/ai-insight/input-builder";
import { buildAiFallbackOutput, generateAiInsightOutput } from "@/services/ai-insight/generation";
import { completeAiRequest, createAiRequest, saveAiInsight } from "@/services/ai-insight/insight-repository";

export async function generateAndSaveAiInsight(patientId: string): Promise<AiInsight> {
  const snapshot = await buildAiInsightInput(patientId);
  if (!snapshot) throw new Error("Patient not found.");

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
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
    const { output, tokensUsed, modelUsed } = await generateAiInsightOutput(snapshot);
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

    return saveAiInsight({
      clinic_id: snapshot.patient.clinic_id,
      patient_id: patientId,
      ai_request_id: aiRequest.id,
      input_snapshot: snapshot,
      output,
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
