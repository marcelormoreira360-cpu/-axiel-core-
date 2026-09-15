/**
 * madrs-s.ts — pontuação do MADRS-S (Montgomery-Åsberg Depression Rating Scale,
 * versão AUTOAPLICÁVEL). PURO, sem I/O.
 *
 * ⚠️ LICENÇA / COPYRIGHT: a MADRS/MADRS-S é protegida (Montgomery & Åsberg, 1979).
 * Por isso este arquivo contém APENAS a MATEMÁTICA da pontuação e as FAIXAS
 * (fatos, não protegidos). O TEXTO dos 9 itens NÃO fica no código — seria
 * distribuição do conteúdo protegido a todos os tenants do SaaS (cenário de alto
 * risco apontado pelo parecer do Lex). O módulo só liga por clínica com licença
 * (feature-flag `madrs_s_enabled`); a clínica licenciada fornece o texto validado
 * dos itens (códigos madrs_s_1..madrs_s_9). NÃO usar a versão de marca da Flow.
 *
 * Escala: 9 itens, 0–6 cada, total 0–54. Faixas usuais (autorrelato):
 *   0–12 mínima · 13–19 leve · 20–34 moderada · ≥35 grave.
 * NÃO diagnóstico; sinalização clínica.
 */

export const MADRS_S_ITEMS = [
  "madrs_s_1", "madrs_s_2", "madrs_s_3", "madrs_s_4", "madrs_s_5",
  "madrs_s_6", "madrs_s_7", "madrs_s_8", "madrs_s_9",
] as const;

export type MadrsSScore = {
  total: number;      // 0..54
  max: number;        // 54
  answered: number;   // itens respondidos
  itemCount: number;  // 9
  complete: boolean;  // answered === 9 (escore só é válido se completo)
  band: string;       // faixa (confiável se complete)
};

/** Faixa oficial do MADRS-S (total 0–54). */
export function madrsSBand(total: number): string {
  if (total <= 12) return "mínima";
  if (total <= 19) return "leve";
  if (total <= 34) return "moderada";
  return "grave";
}

function to0to6(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(6, Math.round(n)));
}

/** Soma os 9 itens (0–6) no total oficial 0–54 + faixa. */
export function computeMadrsS(answers: Record<string, unknown>): MadrsSScore {
  let total = 0;
  let answered = 0;
  for (const code of MADRS_S_ITEMS) {
    const n = to0to6(answers[code]);
    if (n !== null) { total += n; answered += 1; }
  }
  return {
    total,
    max: 54,
    answered,
    itemCount: MADRS_S_ITEMS.length,
    complete: answered === MADRS_S_ITEMS.length,
    band: madrsSBand(total),
  };
}
