// Classificação de grau de disfunção a partir das faixas configuradas no template.
// Puro (sem I/O) para ser usado em server e client.

import type { ScoreBand, ScoringConfig } from "@/lib/types";

export const EMPTY_SCORING_CONFIG: ScoringConfig = {
  total_bands: [],
  section_bands: [],
  flag_item_max: true,
};

// Normaliza um valor possivelmente nulo/legado vindo do banco.
export function normalizeScoringConfig(raw: unknown): ScoringConfig {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SCORING_CONFIG };
  const obj = raw as Partial<ScoringConfig>;
  return {
    total_bands: Array.isArray(obj.total_bands) ? obj.total_bands : [],
    section_bands: Array.isArray(obj.section_bands) ? obj.section_bands : [],
    flag_item_max: obj.flag_item_max !== false,
  };
}

// Encontra a faixa em que um valor se encaixa (min ≤ valor ≤ max; max=null = aberto).
export function gradeValue(value: number, bands: ScoreBand[] | null | undefined): ScoreBand | null {
  if (!bands || bands.length === 0) return null;
  for (const b of bands) {
    const min = Number(b.min ?? 0);
    const max = b.max == null ? Infinity : Number(b.max);
    if (value >= min && value <= max) return b;
  }
  return null;
}

export function gradeTotal(total: number, config: ScoringConfig | null): ScoreBand | null {
  return gradeValue(total, config?.total_bands);
}

export function gradeSection(score: number, config: ScoringConfig | null): ScoreBand | null {
  return gradeValue(score, config?.section_bands);
}

// Item "em disfunção" = atingiu a pontuação máxima (ex.: 4 no QRM/Q-SNA).
export function isItemFlagged(
  value: number | null | undefined,
  maxScore: number | null | undefined,
  config: ScoringConfig | null,
): boolean {
  if (!config?.flag_item_max) return false;
  if (value == null || maxScore == null || maxScore <= 0) return false;
  return value >= maxScore;
}
