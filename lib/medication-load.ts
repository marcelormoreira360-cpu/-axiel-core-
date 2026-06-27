/**
 * medication-load.ts — Medicação (carga): nº de MEDICAMENTOS → valor 0-10 do item
 * `medicacao_carga` (pilar Bioquímico do Mapa Bio³). Suplementos NÃO contam
 * (decisão clínica do Marcelo). Puro/testável; não chama IA nem banco.
 *
 * Mapa (no motor: valor × 10 = disfunção; bandas symptom: ≤30 Baixo/verde,
 * 31-69 Moderado/amarelo, ≥70 Alto/vermelho):
 *   0 remédios → 0 (sem carga) · 1-2 → 2 (verde) · 3-4 → 5 (amarelo) · 5+ → 8 (vermelho)
 */

export const MEDICACAO_CARGA_CODE = "medicacao_carga";

export type MedicationLoadBand = "sem_carga" | "verde" | "amarelo" | "vermelho";

/** Normaliza para inteiro >= 0. */
function clampCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/** nº de medicamentos → valor 0-10 do item `medicacao_carga`. */
export function medicationLoadValue(medicationCount: number): number {
  const n = clampCount(medicationCount);
  if (n === 0) return 0;
  if (n <= 2) return 2;
  if (n <= 4) return 5;
  return 8;
}

/** nº de medicamentos → faixa de cor (para rótulo/UI). */
export function medicationLoadBand(medicationCount: number): MedicationLoadBand {
  const n = clampCount(medicationCount);
  if (n === 0) return "sem_carga";
  if (n <= 2) return "verde";
  if (n <= 4) return "amarelo";
  return "vermelho";
}
