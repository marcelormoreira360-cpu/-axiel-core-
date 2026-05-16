import { BillingPlanCard } from "@/components/billing-plan-card";
import { AXIEL_PLANS } from "@/modules/billing/plan-config";

export default function OnboardingPlanPage() {
  return (
    <main className="min-h-screen bg-axiel-background p-4 md:p-8 space-y-8">
      <section>
        <p className="text-sm text-axiel-text-secondary">Onboarding</p>
        <h1 className="text-3xl font-semibold text-axiel-text-primary">Choose your plan</h1>
        <p className="mt-2 text-axiel-text-secondary">
          Start simple. You can adjust your plan later.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Object.values(AXIEL_PLANS).map((plan) => (
          <BillingPlanCard key={plan.slug} plan={plan} current={false} />
        ))}
      </section>
    </main>
  );
}
