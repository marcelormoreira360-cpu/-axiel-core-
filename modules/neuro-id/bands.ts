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

export type BandColors = { fill: string; stroke: string; text: string };
export type Band = {
  key: BandKey;
  colors: BandColors;
  /** chave de ícone — o consumidor mapeia (lucide na UI, símbolo no PDF). */
  icon: BandIcon;
};

// Cores (light) do _BRIEF_BIO3_VISUAL.md. Terracota = cor de marca.
const BANDS: Record<BandKey, Band> = {
  solto:      { key: "solto",      icon: "check", colors: { fill: "#DCEBE0", stroke: "#5E8C6A", text: "#3E6B4E" } },
  tenso:      { key: "tenso",      icon: "alert", colors: { fill: "#F4E4C8", stroke: "#C98A3C", text: "#8A5A14" } },
  bloqueado:  { key: "bloqueado",  icon: "ban",   colors: { fill: "#EFD7CC", stroke: "#C2643C", text: "#8A3216" } },
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
