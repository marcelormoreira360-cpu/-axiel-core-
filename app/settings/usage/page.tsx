import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35 mt-2">Configurações</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Uso e limites</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Acompanhe os limites do plano e o uso atual da clínica.
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
