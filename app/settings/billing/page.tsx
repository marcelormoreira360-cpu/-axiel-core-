import { BillingPlanCard } from "@/components/billing-plan-card";
import { SubscriptionStatusCard } from "@/components/subscription-status-card";
import { AXIEL_PLANS } from "@/modules/billing/plan-config";

export default function BillingSettingsPage() {
  const currentPlanSlug = "professional";

  return (
    <main className="min-h-screen bg-axiel-background p-4 md:p-8 space-y-8">
      <section>
        <p className="text-sm text-axiel-text-secondary">Settings</p>
        <h1 className="text-3xl font-semibold text-axiel-text-primary">Billing</h1>
        <p className="mt-2 text-axiel-text-secondary">
          Manage your clinic plan, trial, and subscription.
        </p>
      </section>

      <SubscriptionStatusCard
        planName="Professional"
        status="trialing"
        trialEndsAt="14 days remaining"
      />

      <section className="grid gap-4 md:grid-cols-3">
        {Object.values(AXIEL_PLANS).map((plan) => (
          <BillingPlanCard
            key={plan.slug}
            plan={plan}
            current={plan.slug === currentPlanSlug}
          />
        ))}
      </section>
    </main>
  );
}
