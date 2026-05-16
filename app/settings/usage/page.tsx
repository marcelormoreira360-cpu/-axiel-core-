import { UsageLimitCard } from "@/components/usage-limit-card";
import { AXIEL_PLANS } from "@/modules/billing/plan-config";

export default function UsageSettingsPage() {
  const plan = AXIEL_PLANS.professional;

  const usage = {
    users: 4,
    patients: 128,
    forms: 12,
    ai_insights: 34,
    locations: 1,
  };

  return (
    <main className="min-h-screen bg-axiel-background p-4 md:p-8 space-y-8">
      <section>
        <p className="text-sm text-axiel-text-secondary">Settings</p>
        <h1 className="text-3xl font-semibold text-axiel-text-primary">Usage</h1>
        <p className="mt-2 text-axiel-text-secondary">
          Review your clinic limits and current usage.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <UsageLimitCard label="Users" used={usage.users} limit={plan.limits.users} />
        <UsageLimitCard label="Patients" used={usage.patients} limit={plan.limits.patients} />
        <UsageLimitCard label="Forms" used={usage.forms} limit={plan.limits.forms} />
        <UsageLimitCard label="AI Insights" used={usage.ai_insights} limit={plan.limits.ai_insights} />
        <UsageLimitCard label="Locations" used={usage.locations} limit={plan.limits.locations} />
      </section>
    </main>
  );
}
