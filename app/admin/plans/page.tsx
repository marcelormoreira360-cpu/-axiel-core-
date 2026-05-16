import { Card } from "@/components/card";
import { AXIEL_PLANS, formatPlanPrice } from "@/modules/billing/plan-config";

export default function AdminPlansPage() {
  return (
    <main className="min-h-screen bg-axiel-background p-4 md:p-8 space-y-8">
      <section>
        <p className="text-sm text-axiel-text-secondary">Platform Admin</p>
        <h1 className="text-3xl font-semibold text-axiel-text-primary">Plans</h1>
        <p className="mt-2 text-axiel-text-secondary">
          Review the commercial plan structure for AXIEL clinics.
        </p>
      </section>

      <section className="space-y-4">
        {Object.values(AXIEL_PLANS).map((plan) => (
          <Card key={plan.slug} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold text-axiel-text-primary">{plan.name}</p>
              <p className="text-sm text-axiel-text-secondary">{plan.description}</p>
            </div>
            <p className="text-sm font-medium text-axiel-text-primary">
              {formatPlanPrice(plan.priceCents)}
            </p>
          </Card>
        ))}
      </section>
    </main>
  );
}
