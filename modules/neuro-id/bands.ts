/**
 * bands.ts — Mapa Bio³ · sistema de cores semáforo (solto/tenso/bloqueado).
 *
 * Banda definida pela DISFUNÇÃO (0–100). O display ao paciente = disfunção
 * (maior = pior; meta = baixar); a banda reflete isso (solto = pouca disfunção).
 * Acessibilidade: SEMPRE cor + rótulo + ícone (nunca só cor).
 *
 * Util puro (sem React) — usado pelo painel, pelo PDF e pelos testes.
 */

export type BandKey = "solto" | "tenso" | "bloqueado";
export type BandItemType = "mobility" | "pain" | "symptom" | "axis";
export type BandIcon = "check" | "alert" | "ban";

export type BandColors = { fill: string; fillStrong: string; stroke: string; text: string };
export type Band = {
  key: BandKey;
  colors: BandColors;
  /** chave de ícone — o consumidor mapeia (lucide na UI, símbolo no PDF). */
  icon: BandIcon;
};

// Cores (light) do _BRIEF_BIO3_VISUAL.md. Terracota = cor de marca.
const BANDS: Record<BandKey, Band> = {
  solto:      { key: "solto",      icon: "check", colors: { fill: "#DCEBE0", fillStrong: "#B7D8C0", stroke: "#5E8C6A", text: "#3E6B4E" } },
  tenso:      { key: "tenso",      icon: "alert", colors: { fill: "#F4E4C8", fillStrong: "#EACB92", stroke: "#C98A3C", text: "#8A5A14" } },
  bloqueado:  { key: "bloqueado",  icon: "ban",   colors: { fill: "#EFD7CC", fillStrong: "#E2B09A", stroke: "#C2643C", text: "#8A3216" } },
};

/** Banda a partir da DISFUNÇÃO 0–100 (0–30 solto · 31–69 tenso · 70–100 bloqueado). */
export function bandForDysfunction(dysfunction: number | null): Band | null {
  if (dysfunction === null || !Number.isFinite(dysfunction)) return null;
  if (dysfunction <= 30) return BANDS.solto;
  if (dysfunction <= 69) return BANDS.tenso;
  return BANDS.bloqueado;
}

/** Banda a partir de um item 0–10 (×10 → disfunção). ≤3 solto · 4–6 tenso · ≥7 bloqueado. */
export function bandForItem(value0to10: number | null): Band | null {
  if (value0to10 === null || !Number.isFinite(value0to10)) return null;
  return bandForDysfunction(value0to10 * 10);
}

/**
 * Cor CONTÍNUA semáforo (verde→amarelo→vermelho) a partir da DISFUNÇÃO 0–100.
 * O tom intensifica com a gravidade, então dois eixos na mesma banda (ex.: 65 e 68)
 * ficam visualmente distintos. Ancorada nas fronteiras das bandas (30 e 70) para
 * manter coerência com solto/tenso/bloqueado. Retorna as mesmas chaves de BandColors.
 */
export function severityColor(dysfunction: number | null): BandColors {
  if (dysfunction === null || !Number.isFinite(dysfunction)) {
    return { fill: "#E9E7E0", fillStrong: "#E9E7E0", stroke: "#D3D1C7", text: "#A09E98" };
  }
  const d = Math.max(0, Math.min(100, dysfunction)) / 100; // 0..1
  // Matiz moderna: sage(128°) →[30%]→ verde-amarelo(92°) →[70%]→ mel(45°) →[100%]→ coral(12°).
  let hue: number;
  if (d <= 0.3) hue = 128 - (128 - 92) * (d / 0.3);
  else if (d <= 0.7) hue = 92 - (92 - 45) * ((d - 0.3) / 0.4);
  else hue = 45 - (45 - 12) * ((d - 0.7) / 0.3);
  const sat = 32 + 20 * d;          // 32% → 52% (PASTEL moderno: saturação baixa, tom suave e sofisticado)
  const hsl = (l: number) => `hsl(${Math.round(hue)} ${Math.round(sat)}% ${Math.round(l)}%)`;
  return {
    fill:       hsl(94 - 6 * d),    // fundo bem claro do card (94% → 88%)
    fillStrong: hsl(86 - 10 * d),   // preenchimento pastel da pirâmide (86% → 76%)
    stroke:     hsl(66 - 10 * d),   // borda suave (66% → 56%)
    text:       hsl(38 - 7 * d),    // número / rótulo legível (38% → 31%)
  };
}

/**
 * Reparte pesos (ex.: disfunções dos eixos) em porcentagens INTEIRAS que somam
 * exatamente 100 (método do maior resto). `null` é preservado como `null` e não
 * entra na conta. Se a soma dos pesos for ≤ 0, devolve tudo `null`.
 */
export function sharesSummingTo100(weights: (number | null)[]): (number | null)[] {
  const sum = weights.reduce<number>((s, w) => s + (w ?? 0), 0);
  if (sum <= 0) return weights.map(() => null);
  const raw = weights.map((w) => (w === null ? null : (w / sum) * 100));
  const out = raw.map((r) => (r === null ? null : Math.floor(r)));
  let rem = 100 - out.reduce<number>((s, v) => s + (v ?? 0), 0);
  const byFrac = raw
    .map((r, i) => ({ i, frac: r === null ? -1 : r - Math.floor(r) }))
    .filter((o) => o.frac >= 0)
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < byFrac.length && rem > 0; k++) {
    out[byFrac[k].i] = (out[byFrac[k].i] as number) + 1;
    rem--;
  }
  return out;
}

/** Pilares prioritários: o(s) pior(es) eixo(s) — empate/quase-empate dentro de `delta`. */
export function priorityPillars<T extends string>(
  scores: Record<T, number | null>,
  delta = 3,
): T[] {
  const entries = (Object.entries(scores) as [T, number | null][]).filter(
    (e): e is [T, number] => e[1] !== null && Number.isFinite(e[1]),
  );
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map(([, v]) => v));
  if (max <= 0) return [];
  return entries.filter(([, v]) => v >= max - delta).map(([k]) => k);
}

// Rótulo por tipo de item (a banda/cor é a mesma; muda só a palavra). PT.
const LABELS: Record<BandItemType, Record<BandKey, string>> = {
  mobility: { solto: "Solto", tenso: "Tenso", bloqueado: "Bloqueado" },
  pain:     { solto: "Leve", tenso: "Moderada", bloqueado: "Intensa" },
  symptom:  { solto: "Baixo", tenso: "Moderado", bloqueado: "Alto" },
  axis:     { solto: "Solto", tenso: "Tenso", bloqueado: "Bloqueado" },
};

export function labelFor(key: BandKey, itemType: BandItemType = "axis"): string {
  return LABELS[itemType][key];
}

/** Chave i18n do rótulo da banda (a UI traduz via neuroId.band.<itemType>.<key>). */
export function bandLabelKey(key: BandKey, itemType: BandItemType = "axis"): string {
  return `band.${itemType}.${key}`;
}
