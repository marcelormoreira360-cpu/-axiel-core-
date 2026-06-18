/**
 * scoring.ts — Mapa Bio³ · motor de cálculo (PURO, sem I/O).
 *
 * item → DISFUNÇÃO 0–100 → média ponderada por pilar → índice geral → prioridade.
 * Trata dado faltando: calcula com o que há e marca `isPartial` (vira CTA na UI).
 * Display ao paciente = EQUILÍBRIO = 100 − disfunção (ver toEquilibrium).
 */

import type { CatalogItemDef, NeuroPillar, ItemDirection, ItemInputType, ScoringRule } from "./catalog";

/** Subconjunto necessário do item (compatível com CatalogItemDef e com a linha do banco). */
export type ScorableItem = {
  code: string;
  pillar: NeuroPillar;
  direction: ItemDirection;
  input_type: ItemInputType;
  scoring_rule: ScoringRule;
  weight: number;
  partial?: boolean | null;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Normaliza um valor cru em disfunção 0–100. Retorna null quando não há valor
 * utilizável (dado faltando) — o motor então ignora o item no pilar.
 */
export function scoreItem(rawValue: string | number | null | undefined, item: ScorableItem): number | null {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  const rule = item.scoring_rule ?? {};

  switch (item.input_type) {
    case "scale_0_10": {
      const v = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue).replace(",", "."));
      if (!Number.isFinite(v)) return null;
      const capped = Math.max(0, Math.min(10, v));
      return clamp(item.direction === "higher_better" ? (10 - capped) * 10 : capped * 10);
    }
    case "boolean": {
      const truthy = ["true", "1", "sim", "yes"].includes(String(rawValue).trim().toLowerCase());
      const t = rule.trueScore ?? 100;
      const f = rule.falseScore ?? 0;
      return clamp(truthy ? t : f);
    }
    case "choice": {
      const map = rule.choices ?? {};
      const hit = map[String(rawValue)];
      return hit === undefined ? null : clamp(hit);
    }
    case "lab": {
      const map = rule.lab ?? { normal: 0, leve: 25, moderado: 50, alto: 85 };
      const hit = map[String(rawValue).trim().toLowerCase()];
      return hit === undefined ? null : clamp(hit);
    }
    case "med": {
      // raw = nº de medicações sinalizadas (carga). 0 → sem carga.
      const count = typeof rawValue === "number" ? rawValue : parseInt(String(rawValue), 10);
      if (!Number.isFinite(count)) return null;
      const per = rule.perItem ?? 20;
      const max = rule.max ?? 100;
      return clamp(Math.min(count * per, max));
    }
    default:
      return null;
  }
}

export type PillarScore = {
  pillar: NeuroPillar;
  /** disfunção 0–100 (null quando nenhum item do pilar tem valor) */
  dysfunction: number | null;
  itemsUsed: number;
  itemsMissing: number;
  /** códigos de itens faltando que justificam CTA (ex.: exames) */
  missingCtaCodes: string[];
};

export type ScoredItem = { code: string; pillar: NeuroPillar; dysfunction: number | null };

export type NeuroIdResult = {
  pillars: Record<NeuroPillar, PillarScore>;
  /** disfunção geral 0–100 (null se nenhum pilar pôde ser calculado) */
  indiceGeral: number | null;
  /** pilar de MAIOR disfunção = MENOR equilíbrio = prioridade */
  priorityPillar: NeuroPillar | null;
  isPartial: boolean;
  scoredItems: ScoredItem[];
  /** Contribuição relativa de cada pilar ao total de disfunção (soma 100%). */
  contributions: Record<NeuroPillar, number | null>;
};

const PILLARS: NeuroPillar[] = ["fisico", "bioquimico", "emocional"];

/**
 * Contribuição relativa de cada pilar ao total de disfunção (soma 100% entre os
 * pilares com valor). Diz QUAL está pior / por onde começar.
 */
export function pillarContributions(
  dys: Record<NeuroPillar, number | null>,
): Record<NeuroPillar, number | null> {
  const total = PILLARS.reduce((s, p) => s + (dys[p] ?? 0), 0);
  const out = { fisico: null, bioquimico: null, emocional: null } as Record<NeuroPillar, number | null>;
  if (total <= 0) return out;
  for (const p of PILLARS) {
    out[p] = dys[p] === null ? null : ((dys[p] as number) / total) * 100;
  }
  return out;
}

function weightedAvg(pairs: { value: number; weight: number }[]): number | null {
  const totalW = pairs.reduce((s, p) => s + p.weight, 0);
  if (totalW <= 0) return null;
  return pairs.reduce((s, p) => s + p.value * p.weight, 0) / totalW;
}

/**
 * Calcula os 3 eixos + índice geral + prioridade a partir do catálogo e dos
 * valores crus por item_code. `values` = { item_code: raw }.
 */
export function computeNeuroId(
  items: ScorableItem[],
  values: Record<string, string | number | null | undefined>,
): NeuroIdResult {
  const scoredItems: ScoredItem[] = [];
  const pillars = {} as Record<NeuroPillar, PillarScore>;
  for (const p of PILLARS) {
    pillars[p] = { pillar: p, dysfunction: null, itemsUsed: 0, itemsMissing: 0, missingCtaCodes: [] };
  }

  const byPillar: Record<NeuroPillar, { value: number; weight: number }[]> = {
    fisico: [], bioquimico: [], emocional: [],
  };

  for (const item of items) {
    const ds = scoreItem(values[item.code], item);
    scoredItems.push({ code: item.code, pillar: item.pillar, dysfunction: ds });
    const ps = pillars[item.pillar];
    if (ds === null) {
      ps.itemsMissing += 1;
      if (item.partial) ps.missingCtaCodes.push(item.code);
    } else {
      ps.itemsUsed += 1;
      byPillar[item.pillar].push({ value: ds, weight: item.weight > 0 ? item.weight : 1 });
    }
  }

  for (const p of PILLARS) {
    pillars[p].dysfunction = weightedAvg(byPillar[p]);
  }

  // Índice geral = média (igual) dos pilares calculáveis.
  const available = PILLARS.map((p) => pillars[p].dysfunction).filter((v): v is number => v !== null);
  const indiceGeral = available.length ? available.reduce((s, v) => s + v, 0) / available.length : null;

  // Prioridade = pilar de maior disfunção.
  let priorityPillar: NeuroPillar | null = null;
  let maxD = -1;
  for (const p of PILLARS) {
    const d = pillars[p].dysfunction;
    if (d !== null && d > maxD) { maxD = d; priorityPillar = p; }
  }

  // Parcial: algum pilar não pôde ser calculado, ou há itens-CTA faltando, ou
  // algum pilar tem item faltando.
  const isPartial =
    available.length < PILLARS.length ||
    PILLARS.some((p) => pillars[p].itemsMissing > 0);

  const contributions = pillarContributions({
    fisico: pillars.fisico.dysfunction,
    bioquimico: pillars.bioquimico.dysfunction,
    emocional: pillars.emocional.dysfunction,
  });

  return { pillars, indiceGeral, priorityPillar, isPartial, scoredItems, contributions };
}

/** Converte disfunção (0–100) em equilíbrio para exibição ao paciente. */
export function toEquilibrium(dysfunction: number | null): number | null {
  return dysfunction === null ? null : clamp(100 - dysfunction);
}

/** Arredonda para inteiro de exibição (mantém null). */
export function roundPct(v: number | null): number | null {
  return v === null ? null : Math.round(v);
}

/** Conveniência: catálogo default tipado como ScorableItem[] para o motor. */
export function asScorable(items: CatalogItemDef[]): ScorableItem[] {
  return items.map((i) => ({
    code: i.code, pillar: i.pillar, direction: i.direction,
    input_type: i.input_type, scoring_rule: i.scoring_rule, weight: i.weight, partial: i.partial,
  }));
}
