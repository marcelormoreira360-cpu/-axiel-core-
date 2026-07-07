// Notas de segurança CONDICIONAIS do MSQ público (feira Operation BRAVE).
// O BACKEND calcula os flags a partir das respostas; o FRONT só renderiza o
// texto correspondente (copy aprovada em MSQ_result_copy_FINAL.md).
//
// Regra de negócio (Aval/Salvo):
//   A — QUALQUER item sentinela cardíaco/respiratório marcado 3 ou 4.
//   B — o score cai na BANDA MAIS ALTA (faixa 101+ do scoring_config) E A não disparou.
//   C — QUALQUER item de humor marcado 4 (nível máximo).
//   Prioridade: A e C podem coexistir; B só aparece se A NÃO aparecer.
//
// A detecção é feita casando SEÇÃO + TEXTO da pergunta do template MSQ EN
// (definido em app/forms/actions.ts, MSQ_EN_TEMPLATE). É deliberadamente
// CONFIGURÁVEL e tolerante: comparação por texto normalizado (case/espaços/
// pontuação), casando por "contém" para sobreviver a pequenas edições de copy
// no admin. Para manter fácil de ajustar, edite só as listas abaixo.

/** Normaliza um rótulo para casar seção/pergunta sem depender de caixa/pontuação. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, " ")     // pontuação → espaço
    .trim();
}

/** Identificador de um item por seção + texto (ambos casados por "contém"). */
type ItemMatcher = { section: string; text: string };

// ── Sentinelas cardíacas/respiratórias (Cond. A) ────────────────────────────
// Seções HEART e LUNGS do MSQ EN. Marcar 3 ou 4 dispara A.
export const SENTINEL_ITEMS: ItemMatcher[] = [
  { section: "HEART", text: "Chest pain" },
  { section: "HEART", text: "Rapid or pounding heartbeat" },
  { section: "HEART", text: "Irregular or skipped heartbeat" },
  { section: "LUNGS", text: "Shortness of breath" },
  { section: "LUNGS", text: "Difficulty breathing" },
];
// Limiar que dispara a sentinela (marcação >= este valor).
export const SENTINEL_THRESHOLD = 3;

// ── Itens de humor (Cond. C) ────────────────────────────────────────────────
// Seção EMOTIONS do MSQ EN. Marcar 4 (máximo) dispara C.
// (A copy fala "Emotions/Mind"; no template MSQ EN os dois itens vivem em EMOTIONS.)
export const MOOD_ITEMS: ItemMatcher[] = [
  { section: "EMOTIONS", text: "Depression" },
  { section: "EMOTIONS", text: "Mood swings" },
];
// Valor exato de humor que dispara C (nível máximo da escala 0–4).
export const MOOD_MAX_VALUE = 4;

/** Uma resposta já resolvida para seção + texto + valor numérico. */
export type MsqAnswerWithContext = {
  section_title: string | null;
  question_text: string | null;
  value_number: number | null;
};

function matches(answer: MsqAnswerWithContext, m: ItemMatcher): boolean {
  const sec = norm(answer.section_title ?? "");
  const txt = norm(answer.question_text ?? "");
  if (!sec || !txt) return false;
  return sec.includes(norm(m.section)) && txt.includes(norm(m.text));
}

export type MsqSafetyFlags = {
  showA: boolean; // sentinela cardíaco/respiratório 3 ou 4
  showB: boolean; // score na banda mais alta (101+) e A não disparou
  showC: boolean; // humor no nível máximo (4)
};

/**
 * Calcula os flags de nota condicional a partir das respostas com contexto e de
 * `inTopBand` (o total caiu na BANDA MAIS ALTA do scoring_config, faixa 101+).
 * Puro (sem I/O) para ser testável e reutilizável.
 *
 * `inTopBand` é resolvido pelo backend a partir da band do scoring_config (a de
 * maior `min`), não por um limiar de percentual cravado — assim os cortes ficam
 * numa fonte única (MSQ_scoring_config_FINAL.json) e a nota acompanha edições.
 */
export function computeMsqSafetyFlags(
  answers: MsqAnswerWithContext[],
  inTopBand: boolean,
): MsqSafetyFlags {
  let showA = false;
  let showC = false;

  for (const a of answers) {
    const v = a.value_number;
    if (v == null) continue;

    if (!showA && v >= SENTINEL_THRESHOLD && SENTINEL_ITEMS.some((m) => matches(a, m))) {
      showA = true;
    }
    if (!showC && v >= MOOD_MAX_VALUE && MOOD_ITEMS.some((m) => matches(a, m))) {
      showC = true;
    }
    if (showA && showC) break;
  }

  // B só aparece se A NÃO apareceu (A é mais específico e prioritário).
  const showB = !showA && inTopBand;

  return { showA, showB, showC };
}
