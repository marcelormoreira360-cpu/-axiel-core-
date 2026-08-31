// Comparação de nomes para dedup de paciente CONSCIENTE DE FAMÍLIA.
//
// Contexto (incidente 2026-08-21, família Celestino): parentes compartilham o
// MESMO e-mail/telefone (dependente usa o contato do responsável). A migration 140
// removeu de propósito a unique de e-mail justamente por isso. Como consequência,
// dedup que casa só por e-mail/telefone acaba (a) fundindo dois parentes diferentes
// ou (b) arquivando o cadastro errado.
//
// Regra de ouro deste módulo: e-mail/telefone são sinais FRACOS quando o nome não
// bate. Na dúvida, NÃO funde — o pior caso aceitável é criar uma duplicata (chato,
// reversível), nunca fundir/arquivar pessoas diferentes (perda de dados).

/** minúsculas, sem acentos, só alfanumérico + espaço, espaços colapsados.
 *
 * ATENÇÃO (comportamento consciente, finding #6): o filtro `[^a-z0-9\s]` mantém
 * apenas caracteres latinos ASCII. Nomes escritos inteiramente em outros scripts
 * (cirílico, CJK, árabe, etc.) são reduzidos a string vazia. Como `namesMatch`
 * retorna false quando um dos lados é vazio, o dedup fica efetivamente DESLIGADO
 * para esses nomes — o que gera cadastro separado (duplicata). Isso é ACEITÁVEL
 * pela regra de ouro deste módulo (duplicata reversível > fusão errada de pessoas
 * diferentes). Não "consertar" transliterando sem uma estratégia que não aumente
 * o risco de fusão indevida. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(raw: string | null | undefined): string[] {
  const n = normalizeName(raw);
  return n ? n.split(" ").filter(Boolean) : [];
}

/**
 * `true` só quando temos ALTA confiança de que os dois nomes são a MESMA pessoa.
 * Conservador por design (finding #1 do code-review): o casamento "frouxo" antigo
 * (mesmo primeiro nome + um sobrenome em comum) fundia parentes que compartilham
 * contato — ex.: "Ana Paula Souza" vs "Ana Beatriz Souza" no mesmo telefone. Isso
 * viola a regra de ouro (nunca fundir pessoas diferentes).
 *
 * Nova semântica: só casa quando o CONJUNTO de tokens normalizados é IDÊNTICO.
 *  - vazio de um dos lados → false (não dá para confirmar).
 *  - todos os tokens iguais (ignorando acento/caixa/espaço; ordem irrelevante,
 *    comparada por sort dos tokens) → true.
 *  - qualquer token diferente (a mais, a menos ou trocado) → false.
 *
 * Consequências intencionais:
 *  - "João Silva" == "Joao Silva" → true (só acento/caixa).
 *  - "Marina Fumagalli Graveli" == "Marina Graveli Fumagalli" → true (só ordem).
 *  - "João P Silva" != "João Silva" → false (token a mais → duplicata, aceitável).
 *  - "Rafael Castelo" != "Rafael Castelo Branco de Andrade" → false (nome curto
 *    vs completo: pode ser a mesma pessoa, mas na dúvida NÃO funde; duplicata é
 *    o pior caso aceitável).
 */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length !== tb.length) return false;

  const sa = [...ta].sort();
  const sb = [...tb].sort();
  return sa.every((t, i) => t === sb[i]);
}
