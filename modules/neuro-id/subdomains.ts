/**
 * subdomains.ts — SUBDOMÍNIOS por item (agrupamento conceitual do Mapa Bio³).
 *
 * Motivo: o pilar era média direta de ~30 itens, então um sintoma grave (ex.:
 * "acordar várias vezes" = disfunção 100) se diluía num pilar baixo (7). Agora o
 * pilar é a média dos SUBDOMÍNIOS (cada subdomínio = média ponderada dos seus
 * itens), então uma área pequena mas grave (Sono) pesa igual às outras e o grave
 * não some. (Ver _SPEC_FORMULARIO_MESTRE.md §4.)
 *
 * PURO. Este mapa é a "opinião clínica" do agrupamento e é editável num lugar só —
 * mudar aqui recalibra os pilares sem tocar no motor. Código não mapeado cai no
 * subdomínio padrão do pilar ("<pilar>:geral").
 */

import type { NeuroPillar } from "./catalog";

export const SUBDOMAIN_BY_CODE: Record<string, string> = {
  // ── FÍSICO / Biomecânico ─────────────────────────────────────────────────────
  dor: "dor",
  bm_dor: "dor",
  bm_rigidez: "rigidez",
  bm_limitacao: "limitacao",
  bm_equilibrio: "equilibrio",
  bm_fraqueza_muscular: "forca",
  qrm_musculo_articular: "musculoesqueletico",
  msq_joints_muscles: "musculoesqueletico",
  restr_sacroiliaca: "mobilidade_exame",
  restr_capsula_quadril: "mobilidade_exame",
  restr_lombar: "mobilidade_exame",
  restr_tronco_simpatico: "mobilidade_exame",
  restr_visceral_diafragma: "mobilidade_exame",
  restr_clavicular_plexo: "mobilidade_exame",
  restr_vago_ganglio: "mobilidade_exame",
  restr_vago_orelha_temporal: "mobilidade_exame",
  restr_occipto_mastoide: "mobilidade_exame",

  // ── BIOQUÍMICO / Biofuncional ────────────────────────────────────────────────
  bf_sono_iniciar: "sono_ritmos",
  bf_sono_manter: "sono_ritmos",
  bf_sono_reparador: "sono_ritmos",
  bf_sonolencia_dia: "sono_ritmos",
  bf_apneia: "sono_ritmos",
  bf_fadiga: "energia_recuperacao",
  bf_recuperacao: "energia_recuperacao",
  msq_energy: "energia_recuperacao",
  bf_concentracao: "cognicao",
  bf_memoria: "cognicao",
  bf_brain_fog: "cognicao",
  intestino: "gi",
  bf_refluxo: "gi",
  bf_intestino: "gi",
  bf_inchaco: "gi",
  bf_dor_abdominal_estresse: "gi",
  bf_palpitacoes: "cardiovascular",
  bf_tontura_levantar: "cardiovascular",
  bf_termorregulacao: "cardiovascular",
  bf_desconforto_toracico: "cardiovascular",
  bf_pressao_instavel: "cardiovascular",
  bf_falta_ar: "respiratorio",
  bf_respiracao_estresse: "respiratorio",
  ciclo_hormonal: "endocrino_metabolico",
  bf_hormonal: "endocrino_metabolico",
  bf_apetite: "endocrino_metabolico",
  bf_peso: "endocrino_metabolico",
  msq_weight: "endocrino_metabolico",
  hpa_adrenal: "endocrino_metabolico",
  medicacao_carga: "endocrino_metabolico",
  bf_infeccoes: "imune",
  bf_pele_cabelo: "pele_cabelo_unhas",
  msq_skin: "pele_cabelo_unhas",
  bf_olhos: "orl",
  bf_ouvidos: "orl",
  bf_nariz: "orl",
  bf_garganta: "orl",
  msq_eyes: "orl",
  msq_ears: "orl",
  msq_nose: "orl",
  msq_mouth_throat: "orl",
  bf_urinario: "urinario_intimo",
  bf_genital: "urinario_intimo",
  qrm_total: "geral_qrm",
  qsna_total: "geral_qsna",
  msq_other: "bioquimico:geral",
  exame_sangue: "laboratorial",
  exame_cabelo: "laboratorial",

  // ── EMOCIONAL / Bioemocional ─────────────────────────────────────────────────
  // PHQ-9 oficial (itens 1–8; o 9 de ideação não entra no pilar) → depressão.
  phq9_1: "humor_depressao", phq9_2: "humor_depressao", phq9_3: "humor_depressao",
  phq9_4: "humor_depressao", phq9_5: "humor_depressao", phq9_6: "humor_depressao",
  phq9_7: "humor_depressao", phq9_8: "humor_depressao",
  // GAD-7 oficial (7 itens) → ansiedade.
  gad7_1: "ansiedade", gad7_2: "ansiedade", gad7_3: "ansiedade", gad7_4: "ansiedade",
  gad7_5: "ansiedade", gad7_6: "ansiedade", gad7_7: "ansiedade",
  phq9_depressao: "humor_depressao",
  be_mood_humor: "humor_depressao",
  be_mood_apetite: "humor_depressao",
  be_mood_pessimismo: "humor_depressao",
  gad7_ansiedade: "ansiedade",
  be_anx_nervosismo: "ansiedade",
  be_anx_preocupacao_control: "ansiedade",
  be_anx_preocupacao_demais: "ansiedade",
  be_anx_relaxar: "ansiedade",
  be_anx_inquietacao: "ansiedade",
  be_anx_medo_ruim: "ansiedade",
  be_anx_sobressalto: "ansiedade",
  be_mood_tensao: "tensao_hipervigilancia",
  be_reg_irritabilidade: "tensao_hipervigilancia",
  be_reg_hipervigilancia: "tensao_hipervigilancia",
  be_mood_iniciativa: "interesse_prazer",
  be_mood_envolvimento: "interesse_prazer",
  be_mood_concentracao: "cognicao_estresse",
  qrm_mente: "cognicao_estresse",
  qsna_neurocognitiva: "cognicao_estresse",
  msq_mind: "cognicao_estresse",
  qrm_emocoes: "regulacao",
  qsna_emocional: "regulacao",
  msq_emotions: "regulacao",
  be_reg_culpa: "regulacao",
  be_reg_recuperar_estresse: "regulacao",
  hpa_cortisol_baixo: "regulacao",
  hpa_cortisol_alto: "regulacao",
  qsna_sono: "sono_emocional",
  be_mood_sono: "sono_emocional",
  qrm_coracao: "somatizacao",
  qrm_pulmao: "somatizacao",
  qrm_trato_digestivo: "somatizacao",
  qsna_gi_visceral: "somatizacao",
  msq_head: "somatizacao",
  msq_heart: "somatizacao",
  msq_lungs: "somatizacao",
  msq_digestive: "somatizacao",
  biorressonancia_emocional: "laboratorial",
};

/** Subdomínio de um item; código não mapeado cai em "<pilar>:geral". */
export function subdomainFor(code: string, pillar: NeuroPillar): string {
  return SUBDOMAIN_BY_CODE[code] ?? `${pillar}:geral`;
}
