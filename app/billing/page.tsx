import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { BillingPlanCard } from "@/components/billing-plan-card";
import { getBillingOverview } from "@/services/billing-service";
import { AXIEL_PLANS } from "@/modules/billing/plan-config";

export default async function BillingPage() {
  const { clinic, subscription } = await getBillingOverview();

  if (!clinic) redirect("/onboarding");

  const currentPlanSlug = subscription?.plans?.slug ?? null;
  const plans = Object.values(AXIEL_PLANS);

  return (
    <Shell>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Billing</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Choose how AXIEL grows with you</h1>
          <p className="mt-3 max-w-2xl text-lg text-black/55">Simple subscription plans. Upgrade, downgrade, or manage billing from one place.</p>
        </div>
        {subscription?.external_customer_id ? (
          <form action="/api/stripe/portal" method="POST">
            <Button type="submit">Manage subscription</Button>
          </form>
        ) : null}
      </div>

      <Card className="mb-6 grid gap-3 bg-axiel-ink p-6 text-white md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">Current status</p>
          <p className="mt-2 text-2xl font-semibold capitalize">{subscription?.status ?? "No plan"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">Plan</p>
          <p className="mt-2 text-2xl font-semibold">{subscription?.plans?.name ?? "Not selected"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">Trial / period</p>
          <p className="mt-2 text-sm text-white/70">
            {subscription?.trial_ends_at
              ? `Trial ends ${new Date(subscription.trial_ends_at).toLocaleDateString()}`
              : subscription?.current_period_ends_at
                ? `Renews ${new Date(subscription.current_period_ends_at).toLocaleDateString()}`
                : "Start with a trial when available"}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <BillingPlanCard key={plan.slug} plan={plan} current={plan.slug === currentPlanSlug} />
        ))}
      </div>

      <p className="mt-6 text-sm text-black/45">Payments and subscription changes are handled by Stripe Checkout and the Stripe customer portal.</p>
    </Shell>
  );
}
