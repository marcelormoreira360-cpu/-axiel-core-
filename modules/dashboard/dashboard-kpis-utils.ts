/**
 * Pure utility functions for dashboard KPI display.
 * Safe to import in Client Components — zero server dependencies.
 */

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function sessionsDelta(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "nenhuma sessão";
  if (previous === 0) return `${current} este mês`;
  const diff = current - previous;
  if (diff === 0) return "igual ao mês passado";
  return `${diff > 0 ? "+" : ""}${diff} vs. mês passado`;
}

export function revenueDelta(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "sem pagamentos registrados";
  if (previous === 0) return "primeiro mês com dados";
  const diff = current - previous;
  if (diff === 0) return "igual ao mês passado";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${formatBRL(diff)} vs. mês passado`;
}
