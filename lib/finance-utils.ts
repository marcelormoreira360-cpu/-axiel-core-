import type { PaymentMethod } from "@/lib/types";

// Pure formatting utilities — no server deps, safe to import from client components

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Formata um valor na MOEDA da clínica (BRL/USD/EUR). A moeda vem da config da
// clínica (não do idioma); o locale só controla a formatação dos separadores.
export function formatMoney(cents: number, currency: string = "BRL", locale: string = "pt-BR"): string {
  try {
    return (cents / 100).toLocaleString(locale, { style: "currency", currency: (currency || "BRL").toUpperCase() });
  } catch {
    return `${(cents / 100).toFixed(2)} ${(currency || "BRL").toUpperCase()}`;
  }
}

export function paymentMethodLabel(method: PaymentMethod | null) {
  const map: Record<PaymentMethod, string> = {
    pix:         "PIX",
    boleto:      "Boleto",
    credit_card: "Cartão de crédito",
    debit_card:  "Cartão de débito",
    cash:        "Dinheiro",
    transfer:    "Transferência",
    insurance:   "Plano de saúde",
    other:       "Outro",
  };
  return method ? (map[method] ?? method) : "—";
}

export function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { from, to };
}

export function prevMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  return { from, to };
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
