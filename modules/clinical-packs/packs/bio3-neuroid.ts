import { buildAiInsightSystemPrompt } from "@/modules/ai-insights/guardrails";
import { aiInsightJsonShape, coerceAiInsightOutput } from "@/modules/ai-insights/insight-schema";
import {
  buildAtmSuggestionSystemPrompt,
  buildScribeAtmSystemPrompt,
  buildCaseSummarySystemPrompt,
} from "@/services/ai-insight/prompts";
import type { ClinicalPack } from "@/modules/clinical-packs/types";

/**
 * PACK: bio3-neuroid — método da IFWC (Neuro ID 360, Mapa Bio³, Documentos 1/2/3,
 * protocolo de suplementação BR/US).
 *
 * WRAPPER FINO por decisão de projeto: este pack apenas REEXPORTA o que já existe hoje
 * (guardrails.ts, insight-schema.ts, prompts.ts). Objetivo é ZERO regressão para a IFWC:
 * o prompt, o schema e a coerção são byte-a-byte os mesmos de antes da extração. A lógica
 * clínica NÃO foi movida; só passou a ser acessada através do contrato ClinicalPack.
 */
export const bio3NeuroIdPack: ClinicalPack = {
  id: "bio3-neuroid",
  capabilities: { neuroId: true },
  buildReportSystemPrompt: buildAiInsightSystemPrompt,
  reportJsonShape: aiInsightJsonShape as unknown as Record<string, unknown>,
  coerceReportOutput: coerceAiInsightOutput,
  assistantPrompts: {
    atm: buildAtmSuggestionSystemPrompt,
    scribe: buildScribeAtmSystemPrompt,
    caseSummary: buildCaseSummarySystemPrompt,
  },
  // catalogSeed / bands / supplementSeed: preenchidos nos Passos 4 e 6 (não usados ainda).
};
