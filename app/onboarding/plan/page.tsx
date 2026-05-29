import Link from "next/link";
import { BillingPlanCard } from "@/components/billing-plan-card";
import { AXIEL_PLANS } from "@/modules/billing/plan-config";

export default function OnboardingPlanPage() {
  return (
    <main className="min-h-screen bg-axiel-background p-4 md:p-8 space-y-8">
      <section>
        <p className="text-sm text-axiel-text-secondary">Onboarding</p>
        <h1 className="text-3xl font-semibold text-axiel-text-primary">Escolha seu plano</h1>
        <p className="mt-2 text-axiel-text-secondary">
          Comece simples. Você pode mudar de plano a qualquer momento.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Object.values(AXIEL_PLANS).map((plan) => (
          <BillingPlanCard key={plan.slug} plan={plan} current={false} />
        ))}
      </section>

      {/* Trial skip — permite continuar sem cartão agora */}
      <section className="text-center space-y-1 pb-4">
        <p className="text-sm text-axiel-text-secondary">Não tem certeza ainda?</p>
        <Link
          href="/onboarding/ready"
          className="inline-flex items-center gap-1 text-sm font-medium text-axiel-text-primary hover:text-[#0F6E56] transition underline-offset-2 hover:underline"
        >
          Continuar com 14 dias grátis →
        </Link>
        <p className="text-xs text-axiel-text-secondary opacity-60">
          Sem cartão necessário. Escolha um plano depois em Configurações → Faturamento.
        </p>
      </section>
    </main>
  );
}
