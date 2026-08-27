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

/** minúsculas, sem acentos, só alfanumérico + espaço, espaços colapsados. */
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
 * `true` só quando há confiança razoável de que os dois nomes são a MESMA pessoa.
 * Conservador por design:
 *  - vazio de um dos lados → false (não dá para confirmar).
 *  - normalizados idênticos → true.
 *  - se qualquer lado tem menos de 2 tokens (só primeiro nome) → exige igualdade
 *    exata (senão "Maria" casaria com qualquer Maria).
 *  - caso geral: exige MESMO primeiro nome E pelo menos um sobrenome em comum.
 *    Assim "Rafael Castelo" ≈ "Rafael Castelo Branco de Andrade" (mesma pessoa),
 *    mas "Pedro Valpereira" ≠ "Fabio Valpereira" (parentes, mesmo telefone).
 */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length < 2 || tb.length < 2) return false;

  const firstMatch = ta[0] === tb[0];
  if (!firstMatch) return false;
  const restA = new Set(ta.slice(1));
  const sharedSurname = tb.slice(1).some((t) => restA.has(t));
  return sharedSurname;
}
