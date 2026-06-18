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
  { source: "assessment", template_match: "MSQ", section_match: "MIND", catalog_code: "msq_mind" },
  { source: "assessment", template_match: "MSQ", section_match: "EMOTIONS", catalog_code: "msq_emotions" },
  { source: "assessment", template_match: "MSQ", section_match: "HEART", catalog_code: "msq_heart" },
  { source: "assessment", template_match: "MSQ", section_match: "LUNGS", catalog_code: "msq_lungs" },
  { source: "assessment", template_match: "MSQ", section_match: "DIGESTIVE", catalog_code: "msq_digestive" },
  { source: "assessment", template_match: "MSQ", section_match: "JOINTS", catalog_code: "msq_joints_muscles" },
  { source: "assessment", template_match: "MSQ", section_match: "ENERGY", catalog_code: "msq_energy" },
  { source: "assessment", template_match: "MSQ", section_match: "WEIGHT", catalog_code: "msq_weight" },
  { source: "assessment", template_match: "MSQ", section_match: "SKIN", catalog_code: "msq_skin" },
  { source: "assessment", template_match: "MSQ", section_match: "EYES", catalog_code: "msq_eyes" },
  { source: "assessment", template_match: "MSQ", section_match: "EARS", catalog_code: "msq_ears" },
  { source: "assessment", template_match: "MSQ", section_match: "NOSE", catalog_code: "msq_nose" },
  { source: "assessment", template_match: "MSQ", section_match: "MOUTH", catalog_code: "msq_mouth_throat" },
  { source: "assessment", template_match: "MSQ", section_match: "OTHER", catalog_code: "msq_other" },

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
