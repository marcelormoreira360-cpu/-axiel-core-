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

/**
 * `true` só quando temos ALTA confiança de que os dois nomes são a MESMA pessoa.
 * Conservador por design: o casamento "frouxo" original (mesmo primeiro nome + um
 * sobrenome em comum) fundia parentes que compartilham contato — ex.: "Ana Paula
 * Souza" vs "Ana Beatriz Souza" no mesmo telefone. Isso viola a regra de ouro
 * (nunca fundir pessoas diferentes).
 *
 * Semântica: só casa em IGUALDADE EXATA do nome normalizado (mesma ordem de
 * tokens). Igualdade insensível à ordem (finding #6 do code-review) foi DESCARTADA
 * porque funde anagramas de nome ("Maria Silva Santos" vs "Maria Santos Silva"),
 * que podem ser pessoas diferentes — na dúvida, NÃO funde.
 *  - vazio de um dos lados → false (não dá para confirmar).
 *  - nomes normalizados idênticos → true.
 *  - qualquer diferença (token a mais/a menos/trocado/reordenado) → false.
 *
 * Consequências intencionais (o pior caso aceitável é criar duplicata, reversível):
 *  - "João Silva" == "Joao  Silva" → true (só acento/caixa/espaço).
 *  - "Maria Silva Santos" != "Maria Santos Silva" → false (ordem trocada, na dúvida não funde).
 *  - "João P Silva" != "João Silva" → false (token a mais).
 *  - "Rafael Castelo" != "Rafael Castelo Branco de Andrade" → false (curto vs completo).
 */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb;
}
