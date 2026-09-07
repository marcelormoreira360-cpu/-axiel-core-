import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Keep build-time safe in local setup; runtime routes will throw if missing.
}

// apiVersion PINADA na versão do SDK: sem isso, as REQUESTS saem na versão
// default da CONTA Stripe e o formato das respostas pode divergir dos tipos
// do SDK (achado 1.3 da auditoria de robustez). O payload de WEBHOOK segue a
// versão configurada no endpoint do painel — o handler lê formato novo e
// legado onde muda (ex.: invoice.subscription → invoice.parent).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_missing", {
  apiVersion: "2026-06-24.dahlia",
});

// ── Preços por plano E por moeda ──────────────────────────────────────────────
// Cada Price ID do Stripe é de UMA moeda só. Para vender o Core em BRL (clínica
// no Brasil) e USD (clínica nos EUA) a partir da MESMA base de código, mantemos
// um mapa [moeda][plano]. A moeda é decidida por clínica no checkout
// (clinics.billing_currency), não fixada no código.
//
// Back-compat: em BRL usamos primeiro STRIPE_PRICE_<PLANO>_BRL e, se não existir,
// caímos no nome ANTIGO STRIPE_PRICE_<PLANO> — assim o deploy atual continua
// funcionando SEM trocar nenhuma env. Em USD usamos STRIPE_PRICE_<PLANO>_USD.

// BRL: env nova (_BRL) tem prioridade; env antiga (sem sufixo) é o fallback.
const stripePriceBRL = {
  starter:      process.env.STRIPE_PRICE_STARTER_BRL      ?? process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL_BRL ?? process.env.STRIPE_PRICE_PROFESSIONAL,
  scale:        process.env.STRIPE_PRICE_SCALE_BRL        ?? process.env.STRIPE_PRICE_SCALE,
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE_BRL   ?? process.env.STRIPE_PRICE_ENTERPRISE,
} as const;

// USD: só as envs novas. Enquanto não forem setadas, o resolver LANÇA erro para
// uma clínica USD (ver resolveStripePrice) — de propósito: cobrar um cliente dos
// EUA em Reais silenciosamente é pior do que falhar o checkout com mensagem clara.
// O código já está pronto; para vender em USD basta criar os Price IDs em USD e
// setar STRIPE_PRICE_<PLANO>_USD na Vercel.
const stripePriceUSD = {
  starter:      process.env.STRIPE_PRICE_STARTER_USD,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL_USD,
  scale:        process.env.STRIPE_PRICE_SCALE_USD,
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE_USD,
} as const;

// Mantido para back-compat com qualquer import existente (= mapa BRL).
export const stripePriceByPlanCode = stripePriceBRL;

export type StripePlanCode = keyof typeof stripePriceBRL;
export type BillingCurrency = "BRL" | "USD";

// Normaliza a moeda vinda do banco (ou de env) para o que o billing suporta.
// Qualquer valor diferente de "USD" cai em "BRL" — o padrão seguro atual.
export function normalizeBillingCurrency(input?: string | null): BillingCurrency {
  return String(input ?? "").toUpperCase() === "USD" ? "USD" : "BRL";
}

export type ResolvedStripePrice = {
  priceId: string;
  /** Moeda EFETIVAMENTE cobrada. Sempre igual à moeda pedida (sem fallback de moeda). */
  currency: BillingCurrency;
  /** Moeda que foi pedida (a da clínica). */
  requestedCurrency: BillingCurrency;
};

// Resolve o Price ID pelo plano + moeda da clínica. Regra: a moeda cobrada é
// SEMPRE a moeda pedida — não há fallback de moeda. Se pedirem USD e o Price em
// USD não estiver configurado, LANÇA erro claro em vez de cobrar em BRL: cobrar
// um cliente USD em Reais sem avisar é pior do que o checkout falhar com uma
// mensagem que o operador entende (basta setar STRIPE_PRICE_<PLANO>_USD).
export function resolveStripePrice(planCode: string, currency: string = "BRL"): ResolvedStripePrice {
  const plan = planCode as StripePlanCode;
  const requestedCurrency = normalizeBillingCurrency(currency);
  const brl = stripePriceBRL[plan];
  const usd = stripePriceUSD[plan];

  if (requestedCurrency === "USD") {
    if (!usd) {
      throw new Error(
        `Missing Stripe price ID (USD) for plan: ${planCode}. ` +
          `Set STRIPE_PRICE_${plan.toUpperCase()}_USD to sell this plan in USD. ` +
          `Currency fallback to BRL is disabled on purpose (never charge a USD clinic in BRL).`,
      );
    }
    return { priceId: usd, currency: "USD", requestedCurrency };
  }

  if (!brl) {
    throw new Error(`Missing Stripe price ID for plan: ${planCode}`);
  }
  return { priceId: brl, currency: "BRL", requestedCurrency };
}

// Back-compat: assinatura antiga (só planCode) continua funcionando em BRL.
export function getStripePriceId(planCode: string, currency: string = "BRL") {
  return resolveStripePrice(planCode, currency).priceId;
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
