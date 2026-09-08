/**
 * Política de RETENÇÃO de PHI (compliance #9).
 *
 * Princípio: para dado clínico, apagar cedo demais é pior do que guardar demais
 * (viola lei de prontuário e destrói o registro). Por isso o "expurgo" é
 * ANONIMIZAÇÃO (tira o PII, mantém o clínico de-identificado), nunca hard-delete,
 * e os prazos são CONSERVADORES.
 *
 * Prazos por país (decisão de Marcelo; confirmar com o jurídico):
 *  - US: 7 anos após o último contato (cobre FL 5 anos + HIPAA 6 anos de documentação).
 *  - BR: 20 anos após o último contato (prontuário, Res. CFM).
 *  - país desconhecido: usa o MAIOR prazo (20), para nunca anonimizar cedo demais.
 * Menor de idade: nunca antes de (18 anos + o prazo) a partir do nascimento.
 *
 * O campo patients.country é TEXTO LIVRE (ex.: "Brasil", "Brazil", "Estados Unidos",
 * "United States"), então normalizamos por conteúdo.
 */

export const RETENTION_YEARS = { US: 7, BR: 20 } as const;
/** País desconhecido → maior prazo (nunca apaga cedo). */
export const DEFAULT_RETENTION_YEARS = 20;
export const MAJORITY_AGE = 18;

export type RetentionCountry = "US" | "BR" | "OTHER";

export function normalizeRetentionCountry(country?: string | null): RetentionCountry {
  const c = (country ?? "").trim().toLowerCase();
  if (!c) return "OTHER";
  if (c.includes("bras") || c.includes("brazil") || c === "br") return "BR";
  if (
    c.includes("estados unidos") ||
    c.includes("united states") ||
    c === "usa" ||
    c === "us" ||
    c === "eua"
  ) {
    return "US";
  }
  return "OTHER";
}

export function retentionYears(country?: string | null): number {
  const rc = normalizeRetentionCountry(country);
  if (rc === "US") return RETENTION_YEARS.US;
  if (rc === "BR") return RETENTION_YEARS.BR;
  return DEFAULT_RETENTION_YEARS;
}

/** Prazo MÍNIMO possível (qualquer país) — usado para pré-filtrar candidatos. */
export const MIN_RETENTION_YEARS = Math.min(RETENTION_YEARS.US, RETENTION_YEARS.BR);

function addYears(d: Date, years: number): Date {
  const out = new Date(d.getTime());
  out.setFullYear(out.getFullYear() + years);
  return out;
}

/**
 * Data a partir da qual o paciente PODE ser anonimizado. `lastContact` deve ser o
 * MAIOR sinal de contato conhecido (última consulta ou, na falta, a criação do
 * cadastro), para nunca anonimizar com base numa data velha demais.
 */
export function anonymizeEligibleAt(input: {
  country?: string | null;
  lastContact: Date;
  dateOfBirth?: Date | null;
}): Date {
  const years = retentionYears(input.country);
  const base = addYears(input.lastContact, years);
  if (input.dateOfBirth) {
    // Menor: o relógio efetivo só começa na maioridade.
    const minorFloor = addYears(input.dateOfBirth, MAJORITY_AGE + years);
    return base.getTime() > minorFloor.getTime() ? base : minorFloor;
  }
  return base;
}

/** Elegível a anonimizar se a data-limite já passou. */
export function isAnonymizeEligible(
  input: { country?: string | null; lastContact: Date; dateOfBirth?: Date | null },
  now: Date,
): boolean {
  return anonymizeEligibleAt(input).getTime() <= now.getTime();
}
