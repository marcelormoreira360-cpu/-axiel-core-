/**
 * catalog.ts — Mapa Bio³ · catálogo default (item → pilar) da seção 3 do brief.
 *
 * Cada item vira disfunção 0–100 (ver scoring.ts). 3 eixos:
 *   fisico (Biomecânico) · bioquimico (Bioquímico) · emocional (Bioemocional),
 *   conectados pelo SNA. Catálogo é por clínica e editável; estes são os defaults.
 */

export type NeuroPillar = "fisico" | "bioquimico" | "emocional";
export type ItemDirection = "higher_worse" | "higher_better";
export type ItemInputType = "scale_0_10" | "boolean" | "choice" | "lab" | "med";

export type ScoringRule = {
  /** boolean */
  trueScore?: number;
  falseScore?: number;
  /** choice: valor → 0-100 */
  choices?: Record<string, number>;
  /** lab: status (normal/leve/moderado/alto) → 0-100 */
  lab?: Record<string, number>;
  /** med: pontos por item sinalizado + teto */
  perItem?: number;
  max?: number;
};

export type CatalogItemDef = {
  code: string;
  label: string;
  pillar: NeuroPillar;
  direction: ItemDirection;
  input_type: ItemInputType;
  scoring_rule: ScoringRule;
  weight: number;
  sort_order: number;
  /** Itens tipicamente ausentes na 1ª avaliação (exames) → viram CTA quando faltam. */
  partial?: boolean;
};

const LAB_RULE: ScoringRule = { lab: { normal: 0, leve: 25, moderado: 50, alto: 85 } };

export const PILLAR_LABELS: Record<NeuroPillar, string> = {
  fisico: "Biomecânico",
  bioquimico: "Bioquímico",
  emocional: "Bioemocional",
};

/** Mapa item→pilar do brief (seção 3). Direção/pesos default, ajustáveis por clínica. */
export const DEFAULT_CATALOG: CatalogItemDef[] = [
  // ── Físico (Biomecânico — corpo & movimento) ──
  { code: "dor", label: "Dor", pillar: "fisico", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 10 },
  { code: "mob_sacroiliaca", label: "Mobilidade sacro-ilíaca", pillar: "fisico", direction: "higher_better", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 20 },
  { code: "capsula_quadril", label: "Cápsula do quadril", pillar: "fisico", direction: "higher_better", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 30 },
  { code: "lombar", label: "Lombar", pillar: "fisico", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 40 },
  { code: "visceral_diafragma", label: "Visceral + diafragma", pillar: "fisico", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 0.5, sort_order: 50, partial: true },

  // ── Emocional / Neuro (Bioemocional — mente & equilíbrio · SNA) ──
  { code: "tronco_simpatico", label: "Tronco simpático", pillar: "emocional", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 110 },
  { code: "plexo_cardiopulmonar", label: "Infra/supra clavicular + plexo cardíaco/pulmonar", pillar: "emocional", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 120 },
  { code: "vago_ganglio_cervical", label: "Vago + gânglio cervical", pillar: "emocional", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 130 },
  { code: "vago_orelha_temporal", label: "Vago orelha + temporal", pillar: "emocional", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 140 },
  { code: "sutura_occipto_mastoide", label: "Sutura occipto-mastoide", pillar: "emocional", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 150 },
  { code: "qsna", label: "Q-SNA", pillar: "emocional", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 160 },
  { code: "relato_emocional", label: "Relato emocional", pillar: "emocional", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 170 },
  { code: "sono", label: "Sono", pillar: "emocional", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 180 },

  // ── Bioquímico (energia & química interna) ──
  { code: "intestino", label: "Intestino", pillar: "bioquimico", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 210 },
  { code: "ciclo_hormonal", label: "Ciclo / hormonal", pillar: "bioquimico", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 220 },
  { code: "qrm", label: "Q.R.M.", pillar: "bioquimico", direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, weight: 1, sort_order: 230 },
  { code: "medicacao", label: "Medicação (carga)", pillar: "bioquimico", direction: "higher_worse", input_type: "med", scoring_rule: { perItem: 20, max: 100 }, weight: 0.5, sort_order: 240 },
  { code: "exames_sangue_cabelo", label: "Exames (sangue / cabelo)", pillar: "bioquimico", direction: "higher_worse", input_type: "lab", scoring_rule: LAB_RULE, weight: 1, sort_order: 250, partial: true },
];
