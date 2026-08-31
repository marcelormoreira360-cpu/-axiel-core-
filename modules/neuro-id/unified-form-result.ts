/**
 * unified-form-result.ts — GATILHO do Mapa Bio³ a partir das respostas do
 * formulário unificado. PURO (sem I/O): recebe as respostas por código (como
 * gravadas em assessment_answers, com o `code` da pergunta) e devolve o
 * resultado completo — pilares (motor `computeNeuroId`), sinais de segurança e
 * Índice de Complexidade Medicamentosa.
 *
 * A camada de serviço lê as respostas do banco e chama isto; a gravação/exibição
 * do Bio³ fica com quem chama. Motor `scoring.ts` intocado.
 */

import { processUnifiedForm } from "./unified-form-import";
import { computeNeuroId, asScorable, type NeuroIdResult } from "./scoring";
import { DEFAULT_CATALOG } from "./catalog";
import type { SafetyFlags } from "@/lib/safety-flags";
import type { MedicationComplexityInput, MedicationComplexityResult } from "@/lib/medication-complexity";

/** Resposta crua de uma pergunta (formato de assessment_answers + `code`). */
export type AnswerRow = { code: string | null; value: number | null };

export type UnifiedBio3Outcome = {
  /** resultado do motor Bio³ (3 pilares, índice geral, prioridade). */
  neuro: NeuroIdResult;
  /** sinais de segurança (fora do score): cardiorrespiratório e crise. */
  safety: SafetyFlags;
  /** Índice de Complexidade Medicamentosa (separado do Global), se houver input. */
  medication: MedicationComplexityResult | null;
  /** valores 0–10 por código que entraram no motor (auditoria). */
  bio3Values: Record<string, number>;
};

const ITEMS = asScorable(DEFAULT_CATALOG);

/**
 * Respostas por código → Bio³ completo. Ignora linhas sem `code` (legado) e o
 * item de ideação (não pontua). `medInput` vem estruturado pela camada de
 * serviço a partir do Bloco H.
 */
export function bio3FromAnswerRows(rows: AnswerRow[], medInput?: MedicationComplexityInput): UnifiedBio3Outcome {
  const answers: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.code) continue;
    answers[r.code] = r.value;
  }
  const processed = processUnifiedForm(answers, medInput);
  const neuro = computeNeuroId(ITEMS, processed.bio3Values);
  return {
    neuro,
    safety: processed.safety,
    medication: processed.medication,
    bio3Values: processed.bio3Values,
  };
}
