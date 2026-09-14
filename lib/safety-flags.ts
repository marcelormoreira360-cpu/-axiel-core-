/**
 * safety-flags.ts — sinais de SEGURANÇA do intake Neuro ID, FORA do score.
 *
 * Caminho paralelo ao cálculo dos pilares (que usa freq × impacto). Estes flags
 * NÃO entram em `scoring.ts` nem no índice Bio³: servem só para sinalizar ao
 * profissional no resumo pré-consulta. Ver `_BRIEF_NEUROID_FORMULARIO.md` §0.1.1
 * e o bloco de crise.
 *
 * Decisão de Marcelo (28/08): o item de ideação dispara APENAS o encaminhamento
 * estático (988/911) + sinalização; NÃO gradua risco. Aqui `crisis` é um gatilho
 * booleano, nunca um "nível de risco".
 */

/**
 * Gravidade mínima que dispara precaução cardiorrespiratória.
 * A escala do sintoma passou a ser gravidade 0–4 (antes freq 0–3); o limiar 2
 * ("Moderado" ou pior) mantém a mesma sensibilidade nas duas escalas.
 */
export const CARDIORESP_FREQ_THRESHOLD = 2;
/** Nível mínimo (0–6) do item de gosto pela vida que dispara o encaminhamento de crise. */
export const CRISIS_THRESHOLD = 3;

/**
 * Códigos cardiorrespiratórios que disparam precaução pela gravidade do sintoma.
 * Lidos no código único (formato atual); o fallback `<code>_freq` cobre respostas
 * antigas em freq×impacto.
 */
export const CARDIORESP_FREQ_CODES = [
  "bf_desconforto_toracico",
  "bf_falta_ar",
  "bf_palpitacoes",
] as const;

export const CRISIS_CODE = "be_crisis_gosto_vida" as const;

export type SafetyFlags = {
  /** sintoma cardiorrespiratório frequente (≥ limiar), independente do impacto. */
  cardioresp: boolean;
  /** resposta compatível com desejo passivo/ativo de morte → encaminhamento estático. */
  crisis: boolean;
};

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** True se qualquer sintoma cardiorrespiratório atinge a gravidade ≥ limiar. */
export function cardiorespFlag(values: Record<string, unknown>): boolean {
  return CARDIORESP_FREQ_CODES.some((c) => {
    // Formato atual: gravidade no próprio código; fallback ao `<code>_freq` legado.
    const n = toNum(values[c] ?? values[`${c}_freq`]);
    return n !== null && n >= CARDIORESP_FREQ_THRESHOLD;
  });
}

/** True se o item de gosto pela vida atinge o limiar de crise (gatilho binário, não nível). */
export function crisisFlag(values: Record<string, unknown>): boolean {
  const n = toNum(values[CRISIS_CODE]);
  return n !== null && n >= CRISIS_THRESHOLD;
}

/** Avalia todos os sinais de segurança de uma vez. */
export function evaluateSafetyFlags(values: Record<string, unknown>): SafetyFlags {
  return { cardioresp: cardiorespFlag(values), crisis: crisisFlag(values) };
}
