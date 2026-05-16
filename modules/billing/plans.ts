export const PLAN_COPY = {
  starter: {
    badge: "Start simple",
    highlight: "For one clinic getting organized",
    features: ["1 clinic", "Patients, leads, schedule", "Basic intake forms", "Simple follow-ups"],
  },
  professional: {
    badge: "Most complete",
    highlight: "For clinics ready to run the full workflow",
    features: ["Everything in Starter", "AI insight placeholders", "Clinical insights", "Packages and memberships"],
  },
  enterprise: {
    badge: "For scale",
    highlight: "For multi-location or advanced operations",
    features: ["Custom limits", "Advanced support", "Audit and security workflows", "Future custom integrations"],
  },
} as const;

export function formatPrice(priceCents: number, currency = "USD") {
  if (priceCents === 0) return "Custom";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export function trialLabel(days: number | null | undefined) {
  if (!days) return "No trial";
  return `${days}-day trial`;
}
