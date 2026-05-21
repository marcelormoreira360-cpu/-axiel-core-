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
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Cobrança</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Como o AXIEL cresce com você</h1>
          <p className="mt-3 max-w-2xl text-lg text-black/55">Planos simples de assinatura. Faça upgrade, downgrade ou gerencie tudo em um só lugar.</p>
        </div>
        {subscription?.external_customer_id ? (
          <form action="/api/stripe/portal" method="POST">
            <Button type="submit">Gerenciar assinatura</Button>
          </form>
        ) : null}
      </div>

      <Card className="mb-6 grid gap-3 bg-axiel-ink p-6 text-white md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">Status atual</p>
          <p className="mt-2 text-2xl font-semibold capitalize">{subscription?.status ?? "Sem plano"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">Plano</p>
          <p className="mt-2 text-2xl font-semibold">{subscription?.plans?.name ?? "Não selecionado"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">Período / trial</p>
          <p className="mt-2 text-sm text-white/70">
            {subscription?.trial_ends_at
              ? `Trial encerra em ${new Date(subscription.trial_ends_at).toLocaleDateString("pt-BR")}`
              : subscription?.current_period_ends_at
                ? `Renova em ${new Date(subscription.current_period_ends_at).toLocaleDateString("pt-BR")}`
                : "Inicie com um período de teste quando disponível"}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <BillingPlanCard key={plan.slug} plan={plan} current={plan.slug === currentPlanSlug} />
        ))}
      </div>

      <p className="mt-6 text-sm text-black/45">Pagamentos e alterações de assinatura são processados pelo Stripe Checkout e portal do cliente Stripe.</p>
    </Shell>
  );
}
