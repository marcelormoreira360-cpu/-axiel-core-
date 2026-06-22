/**
 * Fusão Bio³: converte as MÉTRICAS dos exames (neurometria, biorressonância) em
 * contribuições de DISFUNÇÃO 0–100% para os 3 pilares, conforme o spec
 * `_SPEC_BIO3_FUSAO_EXAMES.md` (escalas ancoradas no Manual de Neurometria).
 *
 * Convenção Bio³: disfunção 0–100, MAIOR = PIOR. Tudo travado em [0,100].
 * Cada métrica nasce da SUA referência (nada inventado) e é roteada aos pilares
 * por domínio fisiológico, com peso por força de evidência:
 *   neurometria = 1.0 (medida), biorressonância = 0.4 (funcional, não validada).
 */

import type { NeuroPillar } from "./catalog";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Distância de um valor para fora de uma faixa ideal [min,max] (0 se dentro). */
function distOutsideRange(v: number, min: number, max: number): number {
  if (v < min) return min - v;
  if (v > max) return v - max;
  return 0;
}

type PillarRoute = { pillar: NeuroPillar; share: number };

export type ExamMetricDef = {
  code: string;
  label: string;
  instrument: "neurometria" | "biorressonancia";
  instrumentWeight: number;
  /** valor medido (na unidade do exame) -> disfunção 0–100 */
  toDysfunction: (value: number) => number;
  /** roteamento aos pilares (shares somam ~1) */
  routes: PillarRoute[];
  /** peso do item dentro do instrumento (default 1) */
  itemWeight?: number;
};

/** Definições ancoradas no manual (páginas no spec, seção 3). */
export const EXAM_METRICS: ExamMetricDef[] = [
  // ── Neurometria (peso de instrumento 1.0) ──
  {
    code: "neuro_controle_ansiedade", label: "Controle de ansiedade", instrument: "neurometria", instrumentWeight: 1,
    toDysfunction: (v) => clamp((90 - v) / 50 * 100), routes: [{ pillar: "emocional", share: 1 }],
  },
  {
    code: "neuro_hrv", label: "Variabilidade cardíaca (cardio-funcional)", instrument: "neurometria", instrumentWeight: 1,
    toDysfunction: (v) => clamp(Math.abs(v) / 4 * 100), routes: [{ pillar: "emocional", share: 0.7 }, { pillar: "bioquimico", share: 0.3 }],
  },
  {
    code: "neuro_barorreflexo", label: "Índice barorreflexo", instrument: "neurometria", instrumentWeight: 1,
    toDysfunction: (v) => clamp((90 - v) / 20 * 100), routes: [{ pillar: "bioquimico", share: 1 }],
  },
  {
    code: "neuro_hemodinamica", label: "Resposta hemodinâmica / fluxo", instrument: "neurometria", instrumentWeight: 1,
    toDysfunction: (v) => clamp((v - 10) / 30 * 100), routes: [{ pillar: "bioquimico", share: 1 }],
  },
  {
    code: "neuro_temperatura", label: "Temperatura periférica", instrument: "neurometria", instrumentWeight: 1,
    // faixa ideal 31,5–32,5 °C; corte de grave não está no manual -> default 3 °C de desvio = 100%
    toDysfunction: (v) => clamp(distOutsideRange(v, 31.5, 32.5) / 3 * 100), routes: [{ pillar: "emocional", share: 0.6 }, { pillar: "bioquimico", share: 0.4 }],
  },
  {
    code: "neuro_sna_balance", label: "Balanço simpático/parassimpático", instrument: "neurometria", instrumentWeight: 1,
    // valor = frequência simpática %; ideal 50/50
    toDysfunction: (v) => clamp(Math.abs(v - 50) / 50 * 100), routes: [{ pillar: "emocional", share: 1 }],
  },
  {
    code: "neuro_adaptativa", label: "Capacidade adaptativa autonômica", instrument: "neurometria", instrumentWeight: 1, itemWeight: 0.8,
    // positivo: quanto maior melhor
    toDysfunction: (v) => clamp(100 - v), routes: [{ pillar: "emocional", share: 1 }],
  },
  // ── Biorressonância (peso de instrumento 0.4) ──
  {
    code: "bio_carga_emocional", label: "Carga emocional (biorressonância)", instrument: "biorressonancia", instrumentWeight: 0.4,
    // valor já é a carga emocional 0–100 (proporção/intensidade dos itens em excesso)
    toDysfunction: (v) => clamp(v), routes: [{ pillar: "emocional", share: 1 }],
  },
];

const METRIC_BY_CODE: Record<string, ExamMetricDef> = Object.fromEntries(EXAM_METRICS.map((m) => [m.code, m]));

export type PillarContribution = {
  pillar: NeuroPillar;
  code: string;
  label: string;
  instrument: string;
  dysfunction: number; // 0–100
  weight: number;      // peso efetivo (instrumento × share × itemWeight)
};

/**
 * Converte os valores medidos { code: valor } em contribuições por pilar.
 * Só entra métrica com valor presente (número finito). Rastreável: cada contribuição
 * carrega code, instrumento, disfunção e peso.
 */
export function examMetricContributions(values: Record<string, number | null | undefined>): PillarContribution[] {
  const out: PillarContribution[] = [];
  for (const [code, raw] of Object.entries(values)) {
    const def = METRIC_BY_CODE[code];
    if (!def || raw == null || !Number.isFinite(raw)) continue;
    const dys = def.toDysfunction(Number(raw));
    for (const r of def.routes) {
      out.push({
        pillar: r.pillar, code: def.code, label: def.label, instrument: def.instrument,
        dysfunction: dys, weight: def.instrumentWeight * r.share * (def.itemWeight ?? 1),
      });
    }
  }
  return out;
}

/** Média ponderada das contribuições de um pilar (null se nenhuma). */
export function pillarDysfunctionFromContributions(contribs: PillarContribution[], pillar: NeuroPillar): number | null {
  const items = contribs.filter((c) => c.pillar === pillar && Number.isFinite(c.dysfunction));
  if (items.length === 0) return null;
  const wsum = items.reduce((s, i) => s + i.weight, 0);
  if (wsum <= 0) return null;
  return items.reduce((s, i) => s + i.dysfunction * i.weight, 0) / wsum;
}
