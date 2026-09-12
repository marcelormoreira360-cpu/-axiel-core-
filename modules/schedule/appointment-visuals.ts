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

/** Selo de PACOTE: sessões usadas/total do pacote que cobre a sessão. `renew` =
 *  está na última sessão (ou esgotado) → destacar em laranja "Renovar". */
export type PackageBadge = { used: number; total: number; renew: boolean };

/** Pacote do paciente (mínimo p/ o selo). Espelha patient_packages. */
export type PackageLike = { sessions_used: number | null; sessions_total: number; start_date: string };

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
  /** Selo de pacote (sessões usadas/total + renovar) ou null quando não é pacote. */
  packageBadge: PackageBadge | null;
  /** Sessão online (tipo online ou já com link de vídeo/zoom). */
  isOnline: boolean;
};

/**
 * Escolhe o pacote mais relevante do paciente e monta o selo. Prefere um pacote
 * com sessão sobrando (mais antigo primeiro, consome-se primeiro); se todos
 * estiverem esgotados, pega o mais recente para sinalizar "renovar". null se vazio.
 * `renew` quando resta 1 ou 0 sessão (última sessão / esgotado).
 */
export function pickPackageBadge(packages: PackageLike[]): PackageBadge | null {
  if (!packages.length) return null;
  const withRoom = packages
    .filter((p) => (p.sessions_used ?? 0) < p.sessions_total)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const chosen = withRoom[0] ?? [...packages].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const used = Math.min(Math.max(chosen.sessions_used ?? 0, 0), chosen.sessions_total);
  const total = chosen.sessions_total;
  return { used, total, renew: total - used <= 1 };
}

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
