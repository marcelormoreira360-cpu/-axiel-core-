/**
 * segment-instruments.ts — Mapa Bio³ · IA segmentadora de QRM e Q-SNA (Fase 2).
 *
 * A IA SÓ extrai sub-scores de um documento (QRM/Q-SNA) e os roteia para os
 * `code`s do catálogo. NÃO inventa: se um sub-score não está no texto → omite
 * (vira pendente/CTA). O resultado é um RASCUNHO 0–10 que o humano revisa antes
 * de o motor determinístico (scoring.ts) calcular. Sem diagnóstico.
 */

// domínio extraído → code do catálogo
export const SEGMENT_QRM_MAP: Record<string, string> = {
  musculo_articular: "qrm_musculo_articular", // biomecânico
  total: "qrm_total",                          // bioquímico
  coracao: "qrm_coracao",                      // bioemocional
  pulmao: "qrm_pulmao",
  trato_digestivo: "qrm_trato_digestivo",
  mente: "qrm_mente",
  emocoes: "qrm_emocoes",
};

export const SEGMENT_QSNA_MAP: Record<string, string> = {
  total: "qsna_total",                         // bioquímico (overlap, peso 0.5)
  sono: "qsna_sono",                           // bioemocional
  emocional: "qsna_emocional",
  gi_visceral: "qsna_gi_visceral",
  neurocognitiva: "qsna_neurocognitiva",
};

/** Rascunho extraído: code do catálogo → valor 0–10 (disfunção; maior = pior). */
export type SegmentDraft = Record<string, number>;

export const SEGMENT_SYSTEM_PROMPT = `Você é um EXTRATOR de dados de instrumentos clínicos (QRM e Q-SNA) do método Neuro ID.
Sua única tarefa é LER os números que JÁ ESTÃO no documento e expressá-los como sub-scores 0–10 de DISFUNÇÃO (10 = mais disfunção/alteração, 0 = sem alteração), por domínio.
REGRAS (não negociáveis):
- NÃO invente, não estime e não diagnostique. Só converta números presentes no texto.
- Se um domínio NÃO aparece claramente no documento, retorne null para ele (não chute).
- Quando o instrumento usa outra escala, normalize proporcionalmente para 0–10 (ex.: seção 14 de máx 20 → 7). Use apenas valores presentes.
- Sem linguagem de doença/cura. Você só estrutura dados para revisão humana.
Responda SOMENTE com JSON no formato exato:
{
  "qrm": { "musculo_articular": number|null, "total": number|null, "coracao": number|null, "pulmao": number|null, "trato_digestivo": number|null, "mente": number|null, "emocoes": number|null },
  "qsna": { "total": number|null, "sono": number|null, "emocional": number|null, "gi_visceral": number|null, "neurocognitiva": number|null }
}`;

function clamp0to10(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

/** Converte o JSON da IA em { code: valor }, ignorando nulos/ inválidos. */
export function coerceSegmentDraft(parsed: unknown): SegmentDraft {
  const out: SegmentDraft = {};
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const qrm = (obj.qrm ?? {}) as Record<string, unknown>;
  const qsna = (obj.qsna ?? {}) as Record<string, unknown>;

  for (const [domain, code] of Object.entries(SEGMENT_QRM_MAP)) {
    const v = clamp0to10(qrm[domain]);
    if (v !== null) out[code] = v;
  }
  for (const [domain, code] of Object.entries(SEGMENT_QSNA_MAP)) {
    const v = clamp0to10(qsna[domain]);
    if (v !== null) out[code] = v;
  }
  return out;
}
