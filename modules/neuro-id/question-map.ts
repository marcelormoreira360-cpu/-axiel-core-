/**
 * question-map.ts — §8 Bio³ · de-para questionário → pilar (defaults).
 *
 * Mapeia respostas de questionários validados aos codes do catálogo Bio³ e
 * normaliza para DISFUNÇÃO 0–10 (maior = pior). Não inventa valor: só converte
 * respostas existentes; humano revisa antes do motor calcular.
 *
 * Granularidade: SEÇÃO (MSQ/HPA) ou TOTAL do template (PHQ-9/GAD-7). O match é
 * por substring do nome do template e do título da seção (independe de UUID).
 */

export type QuestionMapEntry = {
  source: "assessment" | "intake";
  template_match: string;       // substring do nome do template
  section_match: string | null; // substring do título da seção; null = total
  catalog_code: string;
  weight?: number;
};

/** Normaliza um score bruto (0..max) para disfunção 0–10. null se max inválido. */
export function normalizeToDysfunction10(raw: number | null, max: number | null): number | null {
  if (raw === null || max === null || !Number.isFinite(raw) || !Number.isFinite(max) || max <= 0) return null;
  const v = (raw / max) * 10;
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

/** De-para default (§3). MVP começa pelo MSQ (cobre os 3 pilares). */
export const DEFAULT_QUESTION_MAP: QuestionMapEntry[] = [
  // ── MSQ (15 sistemas → codes) ──
  { source: "assessment", template_match: "MSQ", section_match: "HEAD", catalog_code: "msq_head" },
  // Bioemocional: sistemas vão para os itens qrm_* (um por sistema, sem duplicar com msq_*).
  { source: "assessment", template_match: "MSQ", section_match: "MIND", catalog_code: "qrm_mente" },
  { source: "assessment", template_match: "MSQ", section_match: "EMOTIONS", catalog_code: "qrm_emocoes" },
  { source: "assessment", template_match: "MSQ", section_match: "HEART", catalog_code: "qrm_coracao" },
  { source: "assessment", template_match: "MSQ", section_match: "LUNGS", catalog_code: "qrm_pulmao" },
  { source: "assessment", template_match: "MSQ", section_match: "DIGESTIVE", catalog_code: "qrm_trato_digestivo" },
  { source: "assessment", template_match: "MSQ", section_match: "JOINTS", catalog_code: "qrm_musculo_articular" },
  { source: "assessment", template_match: "MSQ", section_match: "ENERGY", catalog_code: "msq_energy" },
  { source: "assessment", template_match: "MSQ", section_match: "WEIGHT", catalog_code: "msq_weight" },
  { source: "assessment", template_match: "MSQ", section_match: "SKIN", catalog_code: "msq_skin" },
  { source: "assessment", template_match: "MSQ", section_match: "EYES", catalog_code: "msq_eyes" },
  { source: "assessment", template_match: "MSQ", section_match: "EARS", catalog_code: "msq_ears" },
  { source: "assessment", template_match: "MSQ", section_match: "NOSE", catalog_code: "msq_nose" },
  { source: "assessment", template_match: "MSQ", section_match: "MOUTH", catalog_code: "msq_mouth_throat" },
  { source: "assessment", template_match: "MSQ", section_match: "OTHER", catalog_code: "msq_other" },

  // ── Q.R.M. (versão PT-BR do MSQ — "Questionário de Rastreamento Metabólico").
  //    Seções em português; mesmo de-para → codes msq_*. (sem seção PESO no Q.R.M.) ──
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "CABEÇA",   catalog_code: "msq_head" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "OLHOS",    catalog_code: "msq_eyes" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "OUVIDOS",  catalog_code: "msq_ears" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "NARIZ",    catalog_code: "msq_nose" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "BOCA",     catalog_code: "msq_mouth_throat" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "PELE",     catalog_code: "msq_skin" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "CORAÇÃO",  catalog_code: "qrm_coracao" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "PULMÃO",   catalog_code: "qrm_pulmao" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "DIGESTIVO",catalog_code: "qrm_trato_digestivo" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "ARTICULA", catalog_code: "qrm_musculo_articular" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "ENERGIA",  catalog_code: "msq_energy" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "MENTE",    catalog_code: "qrm_mente" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "EMOÇÕES",  catalog_code: "qrm_emocoes" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "OUTROS",   catalog_code: "msq_other" },

  // ── Bioquímico: total do QRM + intestino (puxa da seção digestiva). Decisão de Marcelo. ──
  { source: "assessment", template_match: "Rastreamento Metab", section_match: null,        catalog_code: "qrm_total" },
  { source: "assessment", template_match: "Rastreamento Metab", section_match: "DIGESTIVO", catalog_code: "intestino" },

  // ── Q-SNA (Sistema Nervoso Autônomo). Total = carga autonômica geral (Bioquímico,
  //    peso menor); 4 dimensões específicas → Bioemocional. Codes já no catálogo. ──
  { source: "assessment", template_match: "Q-SNA", section_match: null,             catalog_code: "qsna_total" },
  { source: "assessment", template_match: "Q-SNA", section_match: "SONO",           catalog_code: "qsna_sono" },
  { source: "assessment", template_match: "Q-SNA", section_match: "EMOCIONAL",      catalog_code: "qsna_emocional" },
  { source: "assessment", template_match: "Q-SNA", section_match: "GASTROINTESTINAL",catalog_code: "qsna_gi_visceral" },
  { source: "assessment", template_match: "Q-SNA", section_match: "NEUROCOGNITIVA", catalog_code: "qsna_neurocognitiva" },

  // ── PHQ-9 / GAD-7 (total do template) ──
  { source: "assessment", template_match: "PHQ-9", section_match: null, catalog_code: "phq9_depressao" },
  { source: "assessment", template_match: "GAD-7", section_match: null, catalog_code: "gad7_ansiedade" },

  // ── HPA (seções; PT e EN). estresse/cortisol → emocional; adrenal → bioquímico ──
  { source: "assessment", template_match: "HPA", section_match: "BAIXO CORTISOL", catalog_code: "hpa_cortisol_baixo" },
  { source: "assessment", template_match: "HPA", section_match: "LOW CORTISOL", catalog_code: "hpa_cortisol_baixo" },
  { source: "assessment", template_match: "HPA", section_match: "ALTO CORTISOL", catalog_code: "hpa_cortisol_alto" },
  { source: "assessment", template_match: "HPA", section_match: "HIGH CORTISOL", catalog_code: "hpa_cortisol_alto" },
  { source: "assessment", template_match: "HPA", section_match: "ADRENAL", catalog_code: "hpa_adrenal" },
];
