/**
 * medication-complexity.ts — Índice de Complexidade Medicamentosa Neuro ID (ICM).
 *
 * SEPARADO do score dos pilares e do índice Global Bio³ (não é somado a nada).
 * Mede COMPLEXIDADE TERAPÊUTICA (quantos itens/classes/fatores de manejo a
 * acompanhar), NÃO gravidade de doença nem prova de disfunção fisiológica.
 * O "potencial efeito autonômico" é decidido pelo CLÍNICO, nunca pelo paciente
 * nem concluído pela IA. Ver `_BRIEF_NEUROID_FORMULARIO.md` §H.
 */

export type MedicationComplexityInput = {
  /** nº de medicamentos contínuos em uso. */
  medicationCount: number;
  /** nº de classes terapêuticas (rascunho da IA, confirmado pelo clínico). */
  classCount?: number;
  /** nº de medicamentos com potencial ação autonômica (REVISADO pelo clínico). */
  autonomicFlagged?: number;
  /** frequência de efeitos adversos relatados (0–3). */
  adverseEffectsFreq?: number;
  /** frequência de dificuldade de adesão (0–3). */
  adherenceDifficultyFreq?: number;
  /** mudança de medicação nos últimos 30 dias. */
  recentChange?: boolean;
};

export type MedicationComplexityBand = "baixa" | "moderada" | "elevada" | "muito_elevada";

export type MedicationComplexityResult = {
  /** 0–100 (maior = mais complexo de manejar, NÃO mais grave). */
  score: number;
  band: MedicationComplexityBand;
  /** contribuição de cada componente (para exibir/auditar). */
  components: {
    medications: number;
    classes: number;
    autonomic: number;
    adverseEffects: number;
    adherence: number;
    recentChange: number;
  };
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const n0 = (v: number | undefined) => (Number.isFinite(v as number) ? (v as number) : 0);

/** Faixa operacional (não é corte diagnóstico). */
export function medicationComplexityBand(score: number): MedicationComplexityBand {
  if (score <= 25) return "baixa";
  if (score <= 50) return "moderada";
  if (score <= 75) return "elevada";
  return "muito_elevada";
}

/**
 * Calcula o ICM 0–100 por soma ponderada de componentes (tetos por componente
 * somam 100). Transparente e auditável; nada entra no Global Bio³.
 */
export function computeMedicationComplexity(input: MedicationComplexityInput): MedicationComplexityResult {
  const meds = clamp(Math.min(n0(input.medicationCount), 8) / 8 * 30, 0, 30);
  const classes = clamp(Math.min(n0(input.classCount), 5) / 5 * 20, 0, 20);
  const autonomic = clamp(Math.min(n0(input.autonomicFlagged), 4) / 4 * 20, 0, 20);
  const adverseEffects = clamp(Math.min(n0(input.adverseEffectsFreq), 3) / 3 * 15, 0, 15);
  const adherence = clamp(Math.min(n0(input.adherenceDifficultyFreq), 3) / 3 * 10, 0, 10);
  const recentChange = input.recentChange ? 5 : 0;

  const components = { medications: meds, classes, autonomic, adverseEffects, adherence, recentChange };
  const score = clamp(Math.round(meds + classes + autonomic + adverseEffects + adherence + recentChange));
  return { score, band: medicationComplexityBand(score), components };
}
