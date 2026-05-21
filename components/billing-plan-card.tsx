import { Card } from "@/components/card";
import { ButtonPrimary, ButtonSecondary } from "@/components/button";
import { formatPlanPrice, type PlanConfig } from "@/modules/billing/plan-config";

type BillingPlanCardProps = {
  plan: PlanConfig;
  current?: boolean;
};

export function BillingPlanCard({ plan, current = false }: BillingPlanCardProps) {
  const visibleFeatures = Object.entries(plan.features)
    .filter(([, enabled]) => enabled)
    .slice(0, 5)
    .map(([feature]) => feature.replaceAll("_", " "));

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-semibold text-axiel-text-primary">{plan.name}</p>
          <p className="mt-1 text-sm text-axiel-text-secondary">{plan.description}</p>
        </div>
        {plan.recommended ? (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-axiel-secondary">
            Recomendado
          </span>
        ) : null}
      </div>

      <p className="text-2xl font-semibold text-axiel-text-primary">
        {formatPlanPrice(plan.priceCents)}
      </p>

      <div className="space-y-2">
        {visibleFeatures.map((feature) => (
          <p key={feature} className="text-sm capitalize text-axiel-text-secondary">
            {feature}
          </p>
        ))}
      </div>

      {current ? (
        <ButtonSecondary className="w-full" disabled>
          Plano atual
        </ButtonSecondary>
      ) : (
        <ButtonPrimary className="w-full">Selecionar plano</ButtonPrimary>
      )}
    </Card>
  );
}
