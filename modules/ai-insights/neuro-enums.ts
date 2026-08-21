/**
 * Enums e allow-lists do pipeline Doc 1 persuasivo / Doc 2 (Neuro ID).
 * Ver docs/SPEC_doc1_persuasivo_pipeline.md (§14.1). Sem dependências de lib/types
 * (evita ciclo de import). Os valores aqui são a fonte da verdade para coerção.
 */

export const CONDUTA_EMOCIONAL = ["conduzida_pelo_profissional", "no_documento"] as const;
export type CondutaEmocional = (typeof CONDUTA_EMOCIONAL)[number];
export const DEFAULT_CONDUTA_EMOCIONAL: CondutaEmocional = "conduzida_pelo_profissional";

export const FORMATO_ATENDIMENTO = ["remoto", "presencial", "hibrido"] as const;
export type FormatoAtendimento = (typeof FORMATO_ATENDIMENTO)[number];

export const SUPLEMENTACAO_STAGE = ["nao_iniciada", "pendente_dados_seguranca", "ponteiro_doc3"] as const;
export type SuplementacaoStage = (typeof SUPLEMENTACAO_STAGE)[number];

/** Allow-list de flags clínicas conhecidas (a coerção descarta qualquer flag fora daqui). */
export const KNOWN_CLINICAL_FLAGS = [
  "depressao", "desesperanca", "ideacao_suicida", "luto_perinatal",
  "medicacao_ausente", "gestacao", "condicao_renal", "condicao_hepatica",
] as const;
export type ClinicalFlag = (typeof KNOWN_CLINICAL_FLAGS)[number];

/** País da clínica -> chave i18n do texto de crise (renderiza no locale do paciente). */
export const CRISIS_HOTLINE_BY_COUNTRY: Record<string, string> = {
  BR: "neuroId.crisis.br",   // CVV 188 / SAMU 192
  US: "neuroId.crisis.us",   // 988
};
export const CRISIS_HOTLINE_FALLBACK_KEY = "neuroId.crisis.fallback";

export function coerceCondutaEmocional(
  v: unknown,
  fallback: CondutaEmocional = DEFAULT_CONDUTA_EMOCIONAL,
): CondutaEmocional {
  return (CONDUTA_EMOCIONAL as readonly string[]).includes(String(v)) ? (v as CondutaEmocional) : fallback;
}

export function coerceFormatoAtendimento(v: unknown): FormatoAtendimento | undefined {
  return (FORMATO_ATENDIMENTO as readonly string[]).includes(String(v)) ? (v as FormatoAtendimento) : undefined;
}

export function coerceSuplementacaoStage(v: unknown): SuplementacaoStage | undefined {
  return (SUPLEMENTACAO_STAGE as readonly string[]).includes(String(v)) ? (v as SuplementacaoStage) : undefined;
}

/** Filtra uma lista de flags mantendo só as conhecidas (allow-list). */
export function coerceClinicalFlags(v: unknown): ClinicalFlag[] {
  if (!Array.isArray(v)) return [];
  const known = new Set<string>(KNOWN_CLINICAL_FLAGS);
  return v.map((x) => String(x).trim()).filter((x) => known.has(x)) as ClinicalFlag[];
}
