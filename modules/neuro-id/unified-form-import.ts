/**
 * unified-form-import.ts — fiação do FORMULÁRIO UNIFICADO Neuro ID → Mapa Bio³.
 *
 * Converte as respostas cruas do formulário novo nos valores 0–10 por código do
 * catálogo (que o motor `computeNeuroId` consome), decidindo a escala pelo prefixo
 * do código (freq×impacto, humor 0–6, ansiedade/regulação 0–3). Também deriva os
 * sinais de segurança e o Índice de Complexidade Medicamentosa.
 *
 * PURO (sem I/O). O motor (`scoring.ts`) permanece intocado.
 */

import { CATALOG_BY_CODE } from "./catalog";
import { freqImpToScale10 } from "./questionnaire-scale";
import { evaluateSafetyFlags, type SafetyFlags } from "@/lib/safety-flags";
import {
  computeMedicationComplexity,
  type MedicationComplexityInput,
  type MedicationComplexityResult,
} from "@/lib/medication-complexity";

type ScaleKind = "freqimp" | "mood6" | "scale3";

/** Escala de um código do formulário unificado, pelo prefixo. null = não é do form novo. */
export function unifiedScaleKind(code: string): ScaleKind | null {
  if (code.startsWith("bm_") || code.startsWith("bf_")) return "freqimp";
  if (code.startsWith("be_mood_")) return "mood6";
  if (code.startsWith("be_anx_") || code.startsWith("be_reg_")) return "scale3";
  return null;
}

const clamp10 = (v: number) => Math.max(0, Math.min(10, v));

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Nota crua (0..max) → escala 0–10 do motor. null se ausente. */
function rawToScale10(raw: unknown, max: number): number | null {
  const n = toNum(raw);
  if (n === null || max <= 0) return null;
  return clamp10((Math.max(0, Math.min(max, n)) / max) * 10);
}

/**
 * Respostas cruas do formulário unificado → { catalog_code: 0–10 }, pronto para
 * `computeNeuroId`. Só entram códigos do form novo (bm_/bf_/be_) presentes no
 * catálogo; sintomas usam o par `<code>_freq` + `<code>_imp`. Códigos legados e
 * o item de ideação (não pontua) são ignorados aqui.
 */
export function buildUnifiedBio3Values(answers: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const code of Object.keys(CATALOG_BY_CODE)) {
    const kind = unifiedScaleKind(code);
    if (!kind) continue;
    let v: number | null = null;
    if (kind === "freqimp") {
      v = freqImpToScale10(answers[`${code}_freq`], answers[`${code}_imp`]);
    } else if (kind === "mood6") {
      v = rawToScale10(answers[code], 6);
    } else {
      v = rawToScale10(answers[code], 3);
    }
    if (v !== null) out[code] = v;
  }
  return out;
}

export type UnifiedFormResult = {
  /** valores 0–10 por código, prontos para o motor Bio³. */
  bio3Values: Record<string, number>;
  /** sinais de segurança (fora do score): cardiorrespiratório e crise. */
  safety: SafetyFlags;
  /** Índice de Complexidade Medicamentosa (separado do Global), se houver input. */
  medication: MedicationComplexityResult | null;
};

/**
 * Processa o formulário unificado de ponta a ponta (sem I/O):
 * valores do Bio³ + sinais de segurança + ICM. O `medInput` (contagem de
 * medicamentos etc.) vem estruturado pela camada de UI/serviço, pois o Bloco H
 * é lista repetível; aqui só calculamos o índice a partir dele.
 */
export function processUnifiedForm(
  answers: Record<string, unknown>,
  medInput?: MedicationComplexityInput,
): UnifiedFormResult {
  return {
    bio3Values: buildUnifiedBio3Values(answers),
    safety: evaluateSafetyFlags(answers),
    medication: medInput ? computeMedicationComplexity(medInput) : null,
  };
}
