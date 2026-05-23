export type AxielPlanSlug = "starter" | "professional" | "scale" | "enterprise";

export type PlanLimitKey =
  | "users"
  | "patients"
  | "forms"
  | "ai_insights"
  | "locations";

export type FeatureKey =
  | "leads"
  | "schedule"
  | "forms"
  | "patient_snapshot"
  | "ai_insights"
  | "patient_portal"
  | "product_support"
  | "membership"
  | "stripe_checkout"
  | "follow_up_automation"
  | "whatsapp_automation"
  | "audio_transcription"
  | "advanced_reports"
  | "multi_clinic"
  | "advanced_permissions"
  | "white_label";

export type PlanConfig = {
  slug: AxielPlanSlug;
  name: string;
  description: string;
  /** BRL cents */
  priceCents: number | null;
  /** USD cents */
  priceUsdCents: number | null;
  /** EUR cents */
  priceEurCents: number | null;
  billingInterval: "month" | "custom";
  recommended?: boolean;
  limits: Record<PlanLimitKey, number | null>;
  features: Record<FeatureKey, boolean>;
};

// ─── Feature sets ──────────────────────────────────────────────────────────────

const starterFeatures: Record<FeatureKey, boolean> = {
  leads:                true,
  schedule:             true,
  forms:                true,
  patient_snapshot:     true,
  ai_insights:          false,
  patient_portal:       false,
  product_support:      false,
  membership:           false,
  stripe_checkout:      false,
  follow_up_automation: false,
  whatsapp_automation:  false,
  audio_transcription:  false,
  advanced_reports:     false,
  multi_clinic:         false,
  advanced_permissions: false,
  white_label:          false,
};

const professionalFeatures: Record<FeatureKey, boolean> = {
  leads:                true,
  schedule:             true,
  forms:                true,
  patient_snapshot:     true,
  ai_insights:          true,
  patient_portal:       true,
  product_support:      true,
  membership:           true,
  stripe_checkout:      true,
  follow_up_automation: true,
  whatsapp_automation:  false,
  audio_transcription:  true,
  advanced_reports:     false,
  multi_clinic:         false,
  advanced_permissions: false,
  white_label:          false,
};

const scaleFeatures: Record<FeatureKey, boolean> = {
  leads:                true,
  schedule:             true,
  forms:                true,
  patient_snapshot:     true,
  ai_insights:          true,
  patient_portal:       true,
  product_support:      true,
  membership:           true,
  stripe_checkout:      true,
  follow_up_automation: true,
  whatsapp_automation:  true,
  audio_transcription:  true,
  advanced_reports:     true,
  multi_clinic:         false,
  advanced_permissions: true,
  white_label:          false,
};

const enterpriseFeatures: Record<FeatureKey, boolean> = {
  leads:                true,
  schedule:             true,
  forms:                true,
  patient_snapshot:     true,
  ai_insights:          true,
  patient_portal:       true,
  product_support:      true,
  membership:           true,
  stripe_checkout:      true,
  follow_up_automation: true,
  whatsapp_automation:  true,
  audio_transcription:  true,
  advanced_reports:     true,
  multi_clinic:         true,
  advanced_permissions: true,
  white_label:          true,
};

// ─── Plans ────────────────────────────────────────────────────────────────────

export const AXIEL_PLANS: Record<AxielPlanSlug, PlanConfig> = {
  starter: {
    slug: "starter",
    name: "Starter",
    description: "Para profissionais solo e clínicas pequenas.",
    priceCents:     14700,  // R$ 147
    priceUsdCents:   4900,  // US$ 49
    priceEurCents:   3900,  // € 39
    billingInterval: "month",
    limits: {
      users:       3,
      patients:    150,
      forms:       10,
      ai_insights: 0,
      locations:   1,
    },
    features: starterFeatures,
  },

  professional: {
    slug: "professional",
    name: "Professional",
    description: "Operação clínica completa com IA.",
    priceCents:     29700,  // R$ 297
    priceUsdCents:  12900,  // US$ 129
    priceEurCents:   9900,  // € 99
    billingInterval: "month",
    recommended: true,
    limits: {
      users:       10,
      patients:    1000,
      forms:       50,
      ai_insights: 500,
      locations:   1,
    },
    features: professionalFeatures,
  },

  scale: {
    slug: "scale",
    name: "Scale",
    description: "Para clínicas premium e times em crescimento.",
    priceCents:     69700,  // R$ 697
    priceUsdCents:  29900,  // US$ 299
    priceEurCents:  22900,  // € 229
    billingInterval: "month",
    limits: {
      users:       null,   // ilimitado
      patients:    null,   // ilimitado
      forms:       null,
      ai_insights: null,
      locations:   3,
    },
    features: scaleFeatures,
  },

  enterprise: {
    slug: "enterprise",
    name: "Enterprise",
    description: "Multi-unidade, white-label e onboarding dedicado.",
    priceCents:    null,
    priceUsdCents: null,
    priceEurCents: null,
    billingInterval: "custom",
    limits: {
      users:       null,
      patients:    null,
      forms:       null,
      ai_insights: null,
      locations:   null,
    },
    features: enterpriseFeatures,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPlanConfig(slug: string | null | undefined): PlanConfig {
  if (slug === "professional" || slug === "scale" || slug === "enterprise" || slug === "starter") {
    return AXIEL_PLANS[slug];
  }
  return AXIEL_PLANS.starter;
}

export type CurrencyCode = "BRL" | "USD" | "EUR";

export function formatPlanPrice(plan: PlanConfig, currency: CurrencyCode = "BRL"): string {
  const amount =
    currency === "USD" ? plan.priceUsdCents :
    currency === "EUR" ? plan.priceEurCents :
    plan.priceCents;

  if (amount === null) return "Sob consulta";

  const locale = currency === "BRL" ? "pt-BR" : currency === "EUR" ? "de-DE" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

/** Back-compat for existing billing page */
export function formatPlanPriceLegacy(priceCents: number | null) {
  if (priceCents === null) return "Sob consulta";
  return `R$ ${Math.round(priceCents / 100)}/mês`;
}
