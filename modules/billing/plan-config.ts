export type AxielPlanSlug = "starter" | "professional" | "enterprise";

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
  | "ai_insights"
  | "patient_snapshot"
  | "patient_portal"
  | "product_support"
  | "membership"
  | "multi_clinic"
  | "advanced_permissions"
  | "stripe_checkout";

export type PlanConfig = {
  slug: AxielPlanSlug;
  name: string;
  description: string;
  priceCents: number | null;
  billingInterval: "month" | "custom";
  recommended?: boolean;
  limits: Record<PlanLimitKey, number | null>;
  features: Record<FeatureKey, boolean>;
};

const starterFeatures: Record<FeatureKey, boolean> = {
  leads: true,
  schedule: true,
  forms: true,
  ai_insights: false,
  patient_snapshot: true,
  patient_portal: false,
  product_support: false,
  membership: false,
  multi_clinic: false,
  advanced_permissions: false,
  stripe_checkout: false,
};

const professionalFeatures: Record<FeatureKey, boolean> = {
  leads: true,
  schedule: true,
  forms: true,
  ai_insights: true,
  patient_snapshot: true,
  patient_portal: true,
  product_support: true,
  membership: true,
  multi_clinic: false,
  advanced_permissions: false,
  stripe_checkout: true,
};

const enterpriseFeatures: Record<FeatureKey, boolean> = {
  leads: true,
  schedule: true,
  forms: true,
  ai_insights: true,
  patient_snapshot: true,
  patient_portal: true,
  product_support: true,
  membership: true,
  multi_clinic: true,
  advanced_permissions: true,
  stripe_checkout: true,
};

export const AXIEL_PLANS: Record<AxielPlanSlug, PlanConfig> = {
  starter: {
    slug: "starter",
    name: "Starter",
    description: "Para uma clínica que quer se organizar.",
    priceCents: 7800,
    billingInterval: "month",
    limits: {
      users: 3,
      patients: 250,
      forms: 10,
      ai_insights: 0,
      locations: 1,
    },
    features: starterFeatures,
  },
  professional: {
    slug: "professional",
    name: "Professional",
    description: "Para clínicas prontas para o fluxo completo AXIEL.",
    priceCents: 11800,
    billingInterval: "month",
    recommended: true,
    limits: {
      users: 10,
      patients: 2500,
      forms: 50,
      ai_insights: 500,
      locations: 1,
    },
    features: professionalFeatures,
  },
  enterprise: {
    slug: "enterprise",
    name: "Enterprise",
    description: "Para clínicas com múltiplas unidades e operações avançadas.",
    priceCents: 45000,
    billingInterval: "month",
    limits: {
      users: null,
      patients: null,
      forms: null,
      ai_insights: null,
      locations: null,
    },
    features: enterpriseFeatures,
  },
};

export function getPlanConfig(slug: string | null | undefined): PlanConfig {
  if (slug === "professional" || slug === "enterprise" || slug === "starter") {
    return AXIEL_PLANS[slug];
  }

  return AXIEL_PLANS.starter;
}

export function formatPlanPrice(priceCents: number | null) {
  if (priceCents === null) return "Sob consulta";
  return `R$ ${Math.round(priceCents / 100)}/mês`;
}
