// Barrel de compatibilidade: o serviço de AI Insights foi dividido em módulos
// menores em services/ai-insight/ (refactor puro, sem mudança de comportamento).
// Todos os símbolos públicos continuam exportados deste mesmo caminho.

export { buildAiInsightInput } from "@/services/ai-insight/input-builder";
export type { AiInsightInputSnapshot } from "@/services/ai-insight/input-builder";

export { generateAiInsightOutput, suggestAtmIntegration, suggestScribeAtm } from "@/services/ai-insight/generation";

export {
  createAiRequest,
  completeAiRequest,
  saveAiInsight,
  getPendingAiInsightReviewCount,
  getAiInsightsByPatient,
  archiveAiInsight,
  getLatestFinalAiInsight,
  getLatestAiInsight,
  getLatestAiInsightsByPatients,
  getAiValidationEvents,
  approveAiInsightAsFinal,
  requestAiInsightChanges,
  getPendingAiInsightReviewsForActions,
} from "@/services/ai-insight/insight-repository";
export type { AiValidationEvent } from "@/services/ai-insight/insight-repository";

export { generateAndSaveAiInsight } from "@/services/ai-insight/workflow";

export { sendApprovedInsightToPatient } from "@/services/ai-insight/delivery";
export type { InsightDeliveryChannel, InsightDeliveryResult } from "@/services/ai-insight/delivery";
