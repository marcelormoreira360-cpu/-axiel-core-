/**
 * official-scores.ts — escores OFICIAIS PHQ-9 e GAD-7 (puro, sem I/O).
 *
 * Diferente da leitura Bio³ (disfunção por pilar): aqui é o INSTRUMENTO VALIDADO,
 * somando as respostas cruas 0–3 no total oficial, com as faixas publicadas. Só é
 * um escore válido se TODOS os itens forem respondidos (recall de 2 semanas) — por
 * isso devolvemos `complete`. Domínio público (Pfizer, 2010): uso livre inclusive
 * comercial. NÃO diagnóstico; o corte de rastreio (≥10) é sinalização, não diagnóstico.
 */

export type OfficialScore = {
  total: number;      // soma dos itens respondidos (0..max)
  max: number;        // PHQ-9 = 27, GAD-7 = 21
  answered: number;   // quantos itens vieram respondidos
  itemCount: number;  // total de itens do instrumento
  complete: boolean;  // answered === itemCount (escore só é válido se completo)
  band: string;       // faixa (só confiável se complete)
};

const PHQ9_ITEMS = ["phq9_1","phq9_2","phq9_3","phq9_4","phq9_5","phq9_6","phq9_7","phq9_8","phq9_9"] as const;
const GAD7_ITEMS = ["gad7_1","gad7_2","gad7_3","gad7_4","gad7_5","gad7_6","gad7_7"] as const;

function to0to3(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(3, Math.round(n)));
}

/** Faixa oficial do PHQ-9 (0–27). */
export function phq9Band(total: number): string {
  if (total <= 4) return "mínima";
  if (total <= 9) return "leve";
  if (total <= 14) return "moderada";
  if (total <= 19) return "moderadamente grave";
  return "grave";
}

/** Faixa oficial do GAD-7 (0–21). Corte de rastreio ≥10 (sinalização, não diagnóstico). */
export function gad7Band(total: number): string {
  if (total <= 4) return "mínima";
  if (total <= 9) return "leve";
  if (total <= 14) return "moderada";
  return "grave";
}

function score(answers: Record<string, unknown>, items: readonly string[], max: number, band: (t: number) => string): OfficialScore {
  let total = 0;
  let answered = 0;
  for (const code of items) {
    const n = to0to3(answers[code]);
    if (n !== null) { total += n; answered += 1; }
  }
  const complete = answered === items.length;
  return { total, max, answered, itemCount: items.length, complete, band: band(total) };
}

export function computePhq9(answers: Record<string, unknown>): OfficialScore {
  return score(answers, PHQ9_ITEMS, 27, phq9Band);
}

export function computeGad7(answers: Record<string, unknown>): OfficialScore {
  return score(answers, GAD7_ITEMS, 21, gad7Band);
}

export type OfficialScores = { phq9: OfficialScore; gad7: OfficialScore };

/** Devolve os dois escores oficiais a partir das respostas cruas (só se houver itens). */
export function computeOfficialScores(answers: Record<string, unknown>): OfficialScores {
  return { phq9: computePhq9(answers), gad7: computeGad7(answers) };
}
