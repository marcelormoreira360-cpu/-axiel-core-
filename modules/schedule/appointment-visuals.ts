// ─── Visual da agenda: CORES/SELOS (modelo híbrido, padrão Google Calendar) ────
//
// Regra-mãe: a COR do card = COR DA CATEGORIA do tipo de sessão (faixa lateral).
// O ESTADO do agendamento e o PAGAMENTO viram SELOS (ícone + rótulo), nunca cor
// de fundo. Este módulo é PURO (sem React, sem Supabase) para ser reutilizável no
// servidor (resolução) e no cliente (render dos selos) e testável isoladamente.

import type { Appointment } from "@/lib/types";

/** Cinza neutro: fallback quando o tipo de sessão não tem categoria/cor. */
export const DEFAULT_CATEGORY_COLOR = "#5F5E5A";

/** Estados possíveis do agendamento (espelha appointments.status). */
export type AppointmentStatusKind = NonNullable<Appointment["status"]>;

/** Selo de pagamento calculado. `null` = não exibir (grátis ou coberto por pacote). */
export type PaymentBadgeKind = "paid" | "partial" | "refunded" | "pending";

/**
 * Pacote de dados VISUAIS de um agendamento, já resolvido e SERIALIZÁVEL (só
 * primitivos) para atravessar a fronteira server -> client component. O render
 * (ícone lucide + cor semântica + rótulo i18n) acontece no cliente a partir do
 * `status`/`paymentBadge`.
 */
export type AppointmentVisual = {
  /** Cor da faixa lateral = cor da categoria (ou override do tipo, ou cinza). */
  categoryColor: string;
  /** Nome do ícone tabler da categoria (ex.: 'stethoscope') ou null. */
  categoryIcon: string | null;
  /** Estado do agendamento -> selo de estado. */
  status: AppointmentStatusKind;
  /** Selo de pagamento (ou null quando não se aplica). */
  paymentBadge: PaymentBadgeKind | null;
  /** Sessão online (tipo online ou já com link de vídeo/zoom). */
  isOnline: boolean;
};

/** Linha de pagamento mínima necessária para o cálculo do selo. */
export type PaymentLike = {
  status: string | null;
  amount_cents: number | null;
  refund_amount_cents: number | null;
};

/**
 * Resolve a cor da faixa lateral do card:
 *   color_override (futuro, por tipo) ?? cor da categoria ?? cinza default.
 * Fail-safe: qualquer valor vazio cai no cinza — nunca quebra o render.
 */
export function resolveCategoryColor(
  colorOverride: string | null | undefined,
  categoryColor: string | null | undefined,
): string {
  return (colorOverride?.trim() || categoryColor?.trim() || DEFAULT_CATEGORY_COLOR);
}

/**
 * Selo de PAGAMENTO (MVP). Compara o líquido pago com o devido do tipo de sessão.
 *
 * Regras (conservadoras — na dúvida, ESCONDE em vez de mostrar "Pendente" errado):
 *  - devido <= 0                 -> null  (sessão sem preço: nada a cobrar)
 *  - coberta por pacote          -> null  (o pagamento é do pacote, não da sessão)
 *  - líquido >= devido           -> "paid"
 *  - houve reembolso (e não paga)-> "refunded"
 *  - 0 < líquido < devido        -> "partial"
 *  - nada pago                   -> "pending"
 *
 * Líquido = soma de amount_cents das linhas 'paid'
 *           + (amount_cents - refund) das 'partially_refunded'
 *           + 0 para 'refunded' e 'failed'.
 */
export function computePaymentBadge(input: {
  dueCents: number;
  coveredByPackage: boolean;
  payments: PaymentLike[];
}): PaymentBadgeKind | null {
  const { dueCents, coveredByPackage, payments } = input;

  if (!dueCents || dueCents <= 0) return null;
  if (coveredByPackage) return null;

  let net = 0;
  let hasRefund = false;

  for (const p of payments) {
    const amount = p.amount_cents ?? 0;
    const refund = p.refund_amount_cents ?? 0;
    switch (p.status) {
      case "paid":
        net += amount;
        break;
      case "partially_refunded":
        net += Math.max(0, amount - refund);
        hasRefund = true;
        break;
      case "refunded":
        hasRefund = true; // líquido não soma nada; dinheiro voltou
        break;
      // "failed" e quaisquer outros -> ignora (não conta como pago)
      default:
        break;
    }
  }

  if (net >= dueCents) return "paid";
  // Reembolso que derrubou o líquido abaixo do devido: sinaliza "Reembolsado".
  if (hasRefund) return "refunded";
  if (net > 0) return "partial";
  return "pending";
}
