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

export type ExamInstrument = "neurometria" | "biorressonancia";

export type ExamMetricDef = {
  code: string;
  label: string;
  instrument: ExamInstrument;
  instrumentWeight: number;
  /** valor medido (na unidade do exame) -> disfunção 0–100 */
  toDysfunction: (value: number) => number;
  /** roteamento aos pilares (shares somam ~1) */
  routes: PillarRoute[];
  /** peso do item dentro do instrumento (default 1) */
  itemWeight?: number;
  /** o que a IA deve LER no exame (unidade/significado) — guia da extração */
  extractHint: string;
  /** unidade curta para exibir na revisão (ex.: "%", "°C", "−4 a +4") */
  unit: string;
  /** faixa plausível do valor BRUTO (sanidade da extração); fora dela = descartado */
  rawMin: number;
  rawMax: number;
};

/** Definições ancoradas no manual (páginas no spec, seção 3). */
export const EXAM_METRICS: ExamMetricDef[] = [
  // ── Neurometria (peso de instrumento 1.0) ──
  {
    code: "neuro_controle_ansiedade", label: "Controle de ansiedade", instrument: "neurometria", instrumentWeight: 1,
    toDysfunction: (v) => clamp((90 - v) / 50 * 100), routes: [{ pillar: "emocional", share: 1 }],
    extractHint: "Dimensão 1 (controle de ansiedade / eixo HPA): valor MÉDIO em % (0–100).", unit: "%", rawMin: 0, rawMax: 100,
  },
  {
    code: "neuro_hrv", label: "Variabilidade cardíaca (cardio-funcional)", instrument: "neurometria", instrumentWeight: 1,
    toDysfunction: (v) => clamp(Math.abs(v) / 4 * 100), routes: [{ pillar: "emocional", share: 0.7 }, { pillar: "bioquimico", share: 0.3 }],
    extractHint: "Dimensão 2 (cardio-funcional / HRV): marcador na escala −4 a +4 (0 = ideal). Pode vir com sinal.", unit: "−4 a +4", rawMin: -4, rawMax: 4,
  },
  {
    code: "neuro_barorreflexo", label: "Índice barorreflexo", instrument: "neurometria", instrumentWeight: 1,
    toDysfunction: (v) => clamp((90 - v) / 20 * 100), routes: [{ pillar: "bioquimico", share: 1 }],
    extractHint: "Dimensão 3 (fluxo/hemodinâmica): índice barorreflexo TOTAL em % (0–100). Alto = ótimo.", unit: "%", rawMin: 0, rawMax: 100,
  },
  {
    code: "neuro_hemodinamica", label: "Resposta hemodinâmica / fluxo", instrument: "neurometria", instrumentWeight: 1,
    toDysfunction: (v) => clamp((v - 10) / 30 * 100), routes: [{ pillar: "bioquimico", share: 1 }],
    extractHint: "Dimensão 3 (fluxo/hemodinâmica): resposta hemodinâmica TOTAL em % (0–100).", unit: "%", rawMin: 0, rawMax: 100,
  },
  {
    code: "neuro_temperatura", label: "Temperatura periférica", instrument: "neurometria", instrumentWeight: 1,
    // faixa ideal 31,5–32,5 °C; corte de grave não está no manual -> default 3 °C de desvio = 100%
    toDysfunction: (v) => clamp(distOutsideRange(v, 31.5, 32.5) / 3 * 100), routes: [{ pillar: "emocional", share: 0.6 }, { pillar: "bioquimico", share: 0.4 }],
    extractHint: "Dimensão 4 (termorregulação): temperatura periférica MÉDIA em °C (faixa ideal 31,5–32,5).", unit: "°C", rawMin: 10, rawMax: 45,
  },
  {
    code: "neuro_sna_balance", label: "Balanço simpático/parassimpático", instrument: "neurometria", instrumentWeight: 1,
    // valor = frequência simpática %; ideal 50/50
    toDysfunction: (v) => clamp(Math.abs(v - 50) / 50 * 100), routes: [{ pillar: "emocional", share: 1 }],
    extractHint: "Dimensão 5 (Tilt Test / SNA): frequência SIMPÁTICA em % (0–100; 50 = equilíbrio 50/50).", unit: "% simpático", rawMin: 0, rawMax: 100,
  },
  {
    code: "neuro_adaptativa", label: "Capacidade adaptativa autonômica", instrument: "neurometria", instrumentWeight: 1, itemWeight: 0.8,
    // positivo: quanto maior melhor
    toDysfunction: (v) => clamp(100 - v), routes: [{ pillar: "emocional", share: 1 }],
    extractHint: "Dimensão 6 (vias nervosas): capacidade adaptativa autonômica em % (0–100; maior = melhor).", unit: "%", rawMin: 0, rawMax: 100,
  },
  // ── Biorressonância (peso de instrumento 0.4) ──
  {
    code: "bio_carga_emocional", label: "Carga emocional (biorressonância)", instrument: "biorressonancia", instrumentWeight: 0.4,
    // valor já é a carga emocional 0–100 (proporção/intensidade dos itens em excesso)
    toDysfunction: (v) => clamp(v), routes: [{ pillar: "emocional", share: 1 }],
    extractHint: "Carga emocional GLOBAL 0–100 (intensidade dos itens de Psicologia/Emoções em excesso: |OF/UF| 7–10 ou % 70–100). Estime a proporção/intensidade, sem nomear emoções aqui.", unit: "0–100", rawMin: 0, rawMax: 100,
  },
];

const METRIC_BY_CODE: Record<string, ExamMetricDef> = Object.fromEntries(EXAM_METRICS.map((m) => [m.code, m]));

/** Metadados de exibição por code (label + unidade + instrumento) para a UI de revisão (gate). */
export const EXAM_METRIC_META: Record<string, { label: string; unit: string; instrument: ExamInstrument }> =
  Object.fromEntries(EXAM_METRICS.map((m) => [m.code, { label: m.label, unit: m.unit, instrument: m.instrument }]));

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

// ── Extração por IA (incremento 3): PDF do exame -> valores BRUTOS por code ────
// Guarda-corpo da extração por IA: a IA SÓ lê os números que
// JÁ estão no exame e os devolve na unidade do instrumento; NÃO inventa, NÃO
// estima fora do que está no documento, NÃO diagnostica. O valor cru alimenta
// `examValues` em computeNeuroId, que aplica a conversão determinística -> %.
// Revisão humana obrigatória antes de entrar na pirâmide (gate, incremento 4).

/** Métricas de um instrumento (para gerar prompt/coerce escopados). */
export function metricsForInstrument(instrument: ExamInstrument): ExamMetricDef[] {
  return EXAM_METRICS.filter((m) => m.instrument === instrument);
}

/** System prompt de extração escopado ao instrumento (lista os codes + dicas). */
export function buildMetricExtractionPrompt(instrument: ExamInstrument): string {
  const defs = metricsForInstrument(instrument);
  const lines = defs.map((d) => `- "${d.code}": ${d.extractHint}`).join("\n");
  const shape = `{ ${defs.map((d) => `"${d.code}": number|null`).join(", ")} }`;
  return `Você é um EXTRATOR de valores medidos de um exame funcional (${instrument}) do método Neuro ID.
Sua única tarefa é LER os números que JÁ ESTÃO no exame e devolvê-los na UNIDADE indicada (não converta, não normalize, não calcule disfunção — só transcreva o valor medido).
REGRAS (não negociáveis):
- NÃO invente, não estime e não diagnostique. Só transcreva valores presentes no documento.
- Se uma métrica NÃO aparece claramente no exame, retorne null para ela (não chute).
- Respeite a unidade pedida (%, °C, escala −4..+4). Use ponto decimal.
- Sem linguagem de doença/cura. Você só estrutura dados para revisão humana.
Métricas a extrair:
${lines}
Responda SOMENTE com JSON no formato exato:
${shape}`;
}

/**
 * Funde os `metrics_values` CONFIRMADOS (gate humano) de vários exames num único
 * { code: valor }, pronto para alimentar `examValues` do computeNeuroId.
 * `rows` em ordem CRONOLÓGICA (mais antigo → mais recente): a leitura mais recente
 * vence por métrica. Só entra code conhecido e valor finito.
 */
export function mergeConfirmedMetrics(
  rows: Array<{ metrics_values: Record<string, number> | null | undefined }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (!row.metrics_values) continue;
    for (const [code, v] of Object.entries(row.metrics_values)) {
      if (METRIC_BY_CODE[code] && typeof v === "number" && Number.isFinite(v)) out[code] = v;
    }
  }
  return out;
}

/**
 * Converte o JSON da IA em { code: valorBruto }, escopado ao instrumento.
 * Descarta nulos, não-finitos e valores fora da faixa de sanidade [rawMin,rawMax]
 * (proteção contra alucinação/unidade errada). Pronto para alimentar examValues.
 */
export function coerceExamMetricsDraft(parsed: unknown, instrument: ExamInstrument): Record<string, number> {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const def of metricsForInstrument(instrument)) {
    const v = obj[def.code];
    const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
    if (!Number.isFinite(n)) continue;
    if (n < def.rawMin || n > def.rawMax) continue;
    out[def.code] = n;
  }
  return out;
}
