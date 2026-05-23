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
