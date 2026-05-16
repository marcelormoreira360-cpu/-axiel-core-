import { getPlanConfig, type FeatureKey, type PlanLimitKey } from "./plan-config";

export type ClinicBillingContext = {
  planSlug?: string | null;
  featureOverrides?: Partial<Record<FeatureKey, boolean>>;
  usage?: Partial<Record<PlanLimitKey, number>>;
};

export function canUseFeature(context: ClinicBillingContext, featureKey: FeatureKey) {
  if (typeof context.featureOverrides?.[featureKey] === "boolean") {
    return context.featureOverrides[featureKey] === true;
  }

  const plan = getPlanConfig(context.planSlug);
  return plan.features[featureKey] === true;
}

export function getPlanLimit(context: ClinicBillingContext, limitKey: PlanLimitKey) {
  const plan = getPlanConfig(context.planSlug);
  return plan.limits[limitKey];
}

export function checkUsageLimit(context: ClinicBillingContext, limitKey: PlanLimitKey) {
  const limit = getPlanLimit(context, limitKey);
  const used = context.usage?.[limitKey] ?? 0;

  return {
    used,
    limit,
    isUnlimited: limit === null,
    isAllowed: limit === null || used < limit,
    isAtLimit: limit !== null && used >= limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
  };
}
