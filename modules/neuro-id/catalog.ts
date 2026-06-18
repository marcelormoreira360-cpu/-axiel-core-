/**
 * catalog.ts — Mapa Bio³ · catálogo (item → pilar) corrigido (§2 do brief de ajuste).
 *
 * Escala UNIFICADA: tudo 0–10, `higher_worse` (maior = mais disfunção;
 * disfuncao = valor × 10). Exceção: exames (input_type 'lab', regra por status).
 * Mobilidade/palpação é SEMPRE Biomecânico (teste manual do terapeuta), mesmo
 * quando toca ramos do SNA. QRM e Q-SNA são SEGMENTADOS (sub-scores roteados
 * para pilares diferentes — extraídos pela IA na Fase 2 ou inseridos à mão).
 */

import type { BandItemType } from "./bands";

export type NeuroPillar = "fisico" | "bioquimico" | "emocional";
export type ItemDirection = "higher_worse" | "higher_better";
export type ItemInputType = "scale_0_10" | "boolean" | "choice" | "lab" | "med";

export type ScoringRule = {
  trueScore?: number;
  falseScore?: number;
  choices?: Record<string, number>;
  lab?: Record<string, number>;
  perItem?: number;
  max?: number;
};

export type CatalogItemDef = {
  code: string;
  label: string;
  pillar: NeuroPillar;
  direction: ItemDirection;
  input_type: ItemInputType;
  /** tipo de faixa para rótulo (solto/tenso/bloqueado · leve/mod/intensa · baixo/mod/alto). */
  band_type: BandItemType;
  scoring_rule: ScoringRule;
  weight: number;
  sort_order: number;
  /** Itens tipicamente ausentes na 1ª avaliação (exames) → CTA quando faltam. */
  partial?: boolean;
  /** Item preenchido por questionário/IA (não aparece no form manual vazio). */
  auto?: boolean;
};

const LAB_RULE: ScoringRule = { lab: { normal: 0, leve: 25, moderado: 50, alto: 85 } };

export const PILLAR_LABELS: Record<NeuroPillar, string> = {
  fisico: "Biomecânico",
  bioquimico: "Bioquímico",
  emocional: "Bioemocional",
};

const scale = (
  code: string, label: string, pillar: NeuroPillar, band_type: BandItemType,
  sort_order: number, weight = 1,
): CatalogItemDef => ({
  code, label, pillar, band_type, sort_order, weight,
  direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {},
});

const lab = (code: string, label: string, pillar: NeuroPillar, sort_order: number): CatalogItemDef => ({
  code, label, pillar, band_type: "symptom", sort_order, weight: 1,
  direction: "higher_worse", input_type: "lab", scoring_rule: LAB_RULE, partial: true,
});

// Itens derivados de QUESTIONÁRIO (§8): preenchidos pela importação, não no form manual.
const auto = (
  code: string, label: string, pillar: NeuroPillar, sort_order: number, weight = 1,
): CatalogItemDef => ({
  code, label, pillar, band_type: "symptom", sort_order, weight,
  direction: "higher_worse", input_type: "scale_0_10", scoring_rule: {}, auto: true,
});

/** Mapeamento corrigido do §2. Direção/pesos default, ajustáveis por clínica. */
export const DEFAULT_CATALOG: CatalogItemDef[] = [
  // ── Biomecânico (corpo & movimento) — toda mobilidade/palpação aqui ──
  scale("dor", "Dor", "fisico", "pain", 10),
  scale("restr_sacroiliaca", "Sacro-ilíaca", "fisico", "mobility", 20),
  scale("restr_capsula_quadril", "Cápsula do quadril", "fisico", "mobility", 30),
  scale("restr_lombar", "Lombar", "fisico", "mobility", 40),
  scale("restr_tronco_simpatico", "Tronco simpático", "fisico", "mobility", 50),
  scale("restr_visceral_diafragma", "Visceral + diafragma", "fisico", "mobility", 60),
  scale("restr_clavicular_plexo", "Infra/supra clavicular + plexo cardíaco/pulmonar", "fisico", "mobility", 70),
  scale("restr_vago_ganglio", "Vago + gânglio cervical", "fisico", "mobility", 80),
  scale("restr_vago_orelha_temporal", "Vago orelha + temporal", "fisico", "mobility", 90),
  scale("restr_occipto_mastoide", "Sutura occipto-mastoide / cervical alta", "fisico", "mobility", 100),
  scale("qrm_musculo_articular", "QRM — articulações / músculos", "fisico", "symptom", 110),

  // ── Bioquímico (energia & química interna) ──
  scale("intestino", "Intestino", "bioquimico", "symptom", 210),
  scale("ciclo_hormonal", "Ciclo / hormonal", "bioquimico", "symptom", 220),
  scale("medicacao_carga", "Medicação (carga)", "bioquimico", "symptom", 230, 0.5),
  scale("qrm_total", "QRM — total", "bioquimico", "symptom", 240),
  // Overlap: marcador geral de carga autonômica — peso menor (§4).
  scale("qsna_total", "Q-SNA — total", "bioquimico", "symptom", 250, 0.5),
  lab("exame_sangue", "Exames de sangue", "bioquimico", 260),
  lab("exame_cabelo", "Exame de cabelo", "bioquimico", 270),

  // ── Bioemocional (mente & equilíbrio · SNA) ──
  scale("qrm_coracao", "QRM — coração", "emocional", "symptom", 310),
  scale("qrm_pulmao", "QRM — pulmão", "emocional", "symptom", 320),
  scale("qrm_trato_digestivo", "QRM — trato digestivo", "emocional", "symptom", 330),
  scale("qrm_mente", "QRM — mente", "emocional", "symptom", 340),
  scale("qrm_emocoes", "QRM — emoções", "emocional", "symptom", 350),
  scale("qsna_sono", "Q-SNA — sono / ritmos biológicos", "emocional", "symptom", 360),
  scale("qsna_emocional", "Q-SNA — emocional / psicossocial", "emocional", "symptom", 370),
  scale("qsna_gi_visceral", "Q-SNA — gastrointestinal / visceral", "emocional", "symptom", 380),
  scale("qsna_neurocognitiva", "Q-SNA — neurocognitiva / executiva", "emocional", "symptom", 390),
  lab("biorressonancia_emocional", "Biorressonância emocional", "emocional", 400),

  // ── Questionários (§8) — preenchidos pela importação (auto). MSQ por sistema ──
  // Bioemocional
  auto("msq_head", "MSQ — Cabeça", "emocional", 510, 0.5),
  auto("msq_mind", "MSQ — Mente", "emocional", 520, 0.5),
  auto("msq_emotions", "MSQ — Emoções", "emocional", 530, 0.5),
  auto("msq_heart", "MSQ — Coração", "emocional", 540, 0.5),
  auto("msq_lungs", "MSQ — Pulmão", "emocional", 550, 0.5),
  auto("msq_digestive", "MSQ — Trato digestivo", "emocional", 560, 0.5),
  auto("phq9_depressao", "PHQ-9 — Depressão (total)", "emocional", 570),
  auto("gad7_ansiedade", "GAD-7 — Ansiedade (total)", "emocional", 580),
  auto("hpa_cortisol_baixo", "HPA — Baixo cortisol", "emocional", 590, 0.5),
  auto("hpa_cortisol_alto", "HPA — Alto cortisol", "emocional", 600, 0.5),
  // Biomecânico
  auto("msq_joints_muscles", "MSQ — Articulações / músculos", "fisico", 610, 0.5),
  // Bioquímico
  auto("msq_eyes", "MSQ — Olhos", "bioquimico", 710, 0.5),
  auto("msq_ears", "MSQ — Ouvidos", "bioquimico", 720, 0.5),
  auto("msq_nose", "MSQ — Nariz", "bioquimico", 730, 0.5),
  auto("msq_mouth_throat", "MSQ — Boca / garganta", "bioquimico", 740, 0.5),
  auto("msq_skin", "MSQ — Pele", "bioquimico", 750, 0.5),
  auto("msq_energy", "MSQ — Energia / atividade", "bioquimico", 760, 0.5),
  auto("msq_weight", "MSQ — Peso", "bioquimico", 770, 0.5),
  auto("msq_other", "MSQ — Outros", "bioquimico", 780, 0.5),
  auto("hpa_adrenal", "HPA — Hiperplasia adrenal", "bioquimico", 790, 0.5),
];

/** Lookup por code (band_type, label, pillar) — usado na UI/PDF para itens armazenados. */
export const CATALOG_BY_CODE: Record<string, CatalogItemDef> = Object.fromEntries(
  DEFAULT_CATALOG.map((i) => [i.code, i]),
);
