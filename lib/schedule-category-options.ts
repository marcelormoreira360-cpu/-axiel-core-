// ─── Opções da tela de Categorias da agenda (cores + ícones) ───────────────────
// Módulo PURO (sem React, sem Supabase): usado pelo formulário (cliente) e pela
// validação das server actions. Mantém a paleta e a lista de ícones em fonte única.

/** Cor neutra padrão (espelha DEFAULT_CATEGORY_COLOR do módulo de visuais). */
export const DEFAULT_CATEGORY_COLOR = "#5F5E5A";

/** Paleta de presets (as 9 cores do design), como swatches clicáveis. */
export const PRESET_COLORS = [
  "#0F6E56", // teal
  "#534AB7", // roxo
  "#185FA5", // azul
  "#D85A30", // coral
  "#5F5E5A", // cinza
  "#BA7517", // âmbar
  "#3B6D11", // verde
  "#993556", // rosa
  "#A32D2D", // vermelho
] as const;

/**
 * Nomes de ícones tabler oferecidos no select. TODOS têm equivalente lucide em
 * components/schedule/appointment-visuals-ui.tsx (categoryIconComponent) — manter
 * esta lista sincronizada com o mapa TABLER_TO_LUCIDE de lá.
 */
export const ICON_NAMES = [
  "stethoscope",
  "heartbeat",
  "heart-pulse",
  "activity",
  "microscope",
  "flask",
  "test-pipe",
  "package",
  "clipboard-list",
  "file-text",
  "briefcase",
  "calendar",
  "user",
  "brain",
  "settings",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Valida e normaliza um hex #RRGGBB (aceita #RGB expandindo). Retorna null se inválido. */
export function normalizeHexColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (!v) return null;
  if (!v.startsWith("#")) v = `#${v}`;
  const short = /^#([0-9a-fA-F]{3})$/.exec(v);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return /^#([0-9a-fA-F]{6})$/.test(v) ? v.toUpperCase() : null;
}

/** Normaliza o nome do ícone: só aceita nomes conhecidos (senão null). */
export function normalizeIconName(raw: string | null | undefined): IconName | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return (ICON_NAMES as readonly string[]).includes(v) ? (v as IconName) : null;
}
