import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Keep build-time safe in local setup; runtime routes will throw if missing.
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_missing");

export const stripePriceByPlanCode = {
  starter:      process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  scale:        process.env.STRIPE_PRICE_SCALE,
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE,
} as const;

export type StripePlanCode = keyof typeof stripePriceByPlanCode;

export function getStripePriceId(planCode: string) {
  const priceId = stripePriceByPlanCode[planCode as StripePlanCode];
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for plan: ${planCode}`);
  }
  return priceId;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// Métodos de pagamento: usamos os MÉTODOS DINÂMICOS do Stripe (não fixamos
// payment_method_types nos checkouts). O Stripe mostra automaticamente o que
// estiver ativado no painel, conforme a moeda — cartão sempre; Pix/Boleto
// aparecem sozinhos quando ativados em BRL. Assim, ativar o Pix no Brasil não
// exige mudança de código, e nada quebra onde o Pix não está disponível (US/USD).
// Pix/Boleto são assíncronos: confirmação via checkout.session.async_payment_succeeded.
