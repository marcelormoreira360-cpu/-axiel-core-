// Classificação de grau de disfunção a partir das faixas configuradas no template.
// Puro (sem I/O) para ser usado em server e client.

import type { ScoreBand, ScoringConfig } from "@/lib/types";

export const EMPTY_SCORING_CONFIG: ScoringConfig = {
  total_bands: [],
  section_bands: [],
  flag_item_max: true,
  mode: "absolute",
};

// Normaliza um valor possivelmente nulo/legado vindo do banco.
export function normalizeScoringConfig(raw: unknown): ScoringConfig {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SCORING_CONFIG };
  const obj = raw as Partial<ScoringConfig>;
  // Só aceitamos o modo percentual explícito; qualquer outra coisa cai no legado
  // "absolute" para não mudar o comportamento de nenhum template existente.
  const mode = obj.mode === "percentage_of_max" ? "percentage_of_max" : "absolute";
  return {
    total_bands: Array.isArray(obj.total_bands) ? obj.total_bands : [],
    section_bands: Array.isArray(obj.section_bands) ? obj.section_bands : [],
    flag_item_max: obj.flag_item_max !== false,
    mode,
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

// Classifica o TOTAL respeitando o `mode` do config:
//  - "percentage_of_max": casa a band pelo PERCENTUAL (total/max*100), como o
//    MSQ público da feira (min/max das bands estão em %).
//  - "absolute" (ou ausente): casa pelo valor bruto do total (comportamento legado
//    de todos os outros templates).
// `maxPossible` só é usado no modo percentual; se for <= 0, não há como calcular
// percentual → retorna null (sem faixa) em vez de arriscar uma classificação errada.
export function gradeTotalByMode(
  total: number,
  maxPossible: number,
  config: ScoringConfig | null,
): ScoreBand | null {
  if (config?.mode === "percentage_of_max") {
    if (!(maxPossible > 0)) return null;
    const percent = (total / maxPossible) * 100;
    return gradeValue(percent, config?.total_bands);
  }
  return gradeValue(total, config?.total_bands);
}

export function gradeSection(score: number, config: ScoringConfig | null): ScoreBand | null {
  return gradeValue(score, config?.section_bands);
}

// Verdadeiro se `band` é a faixa MAIS ALTA das total_bands (a de maior `min`).
// Usado para disparar a nota de segurança Cond. B do MSQ quando o score cai na
// banda topo (ex.: 101+), sem cravar o limiar numérico fora do scoring_config.
export function isTopBand(band: ScoreBand | null, config: ScoringConfig | null): boolean {
  if (!band) return false;
  const bands = config?.total_bands;
  if (!bands || bands.length === 0) return false;
  const topMin = Math.max(...bands.map((b) => Number(b.min ?? 0)));
  return Number(band.min ?? 0) === topMin;
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
