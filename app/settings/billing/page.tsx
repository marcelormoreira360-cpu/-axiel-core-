import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BillingPlanCard } from "@/components/billing-plan-card";
import { SubscriptionStatusCard } from "@/components/subscription-status-card";
import { AXIEL_PLANS } from "@/modules/billing/plan-config";

export default function BillingSettingsPage() {
  const currentPlanSlug = "professional";

  return (
    <main className="min-h-screen bg-axiel-background p-4 md:p-8 space-y-8">
      <section>
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35 mt-2">Configurações</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Plano e cobrança</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Gerencie o plano, período de teste e assinatura da clínica.
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
