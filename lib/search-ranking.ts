// Ranking e tokenização da busca global (paciente/lead).
//
// Objetivo: deixar a busca "dinâmica" — casar várias palavras em qualquer ordem
// (prefixo de cada palavra), ignorar acento e caixa, e ordenar por relevância
// (quem começa com o que foi digitado aparece primeiro), sem exigir o nome
// completo. Puro e sem dependências → testável isoladamente.

/** minúsculas + remove acentos (NFD). "José" e "jose" ficam iguais. */
export function normalizeForSearch(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Divide a query em palavras (tokens). Remove caracteres que quebram a sintaxe
 * de filtro do PostgREST (vírgula, parênteses) e limita a 6 tokens para não
 * gerar filtros gigantes. Não normaliza acento aqui (o ilike do banco compara
 * o texto cru); a normalização acontece só no ranking em memória.
 */
export function tokenizeQuery(q: string): string[] {
  return (q ?? "")
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[(),]/g, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Pontuação de relevância (MENOR = melhor). Acento e caixa ignorados.
 *   0 = nome idêntico à query
 *   1 = nome começa com a query inteira ("pedro v" → "Pedro Vitor…")
 *   2 = cada palavra da query é prefixo de alguma palavra do nome (qualquer ordem)
 *   3 = nome contém a query inteira como trecho contíguo
 *   4 = todas as palavras da query aparecem no nome (espalhadas)
 *   5 = casou por outro campo (email/telefone) — pior relevância de nome
 */
export function relevanceScore(name: string, q: string, tokens: string[]): number {
  const n = normalizeForSearch(name);
  const qn = normalizeForSearch(q).trim();
  if (!qn) return 5;
  if (n === qn) return 0;
  if (n.startsWith(qn)) return 1;
  const words = n.split(/\s+/).filter(Boolean);
  const tks = tokens.map(normalizeForSearch).filter(Boolean);
  if (tks.length && tks.every((tk) => words.some((w) => w.startsWith(tk)))) return 2;
  if (n.includes(qn)) return 3;
  if (tks.length && tks.every((tk) => n.includes(tk))) return 4;
  return 5;
}

/**
 * Reordena por relevância e, em empate, por nome; corta em `limit`.
 * `getName` extrai o nome exibível de cada item.
 */
export function rankByRelevance<T>(
  items: T[],
  q: string,
  getName: (item: T) => string,
  limit: number,
): T[] {
  const tokens = tokenizeQuery(q);
  return items
    .map((item) => ({
      item,
      score: relevanceScore(getName(item), q, tokens),
      name: normalizeForSearch(getName(item)),
    }))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((x) => x.item);
}
