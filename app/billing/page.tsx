import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { BillingPlanCard } from "@/components/billing-plan-card";
import { SubscriptionStatusCard } from "@/components/subscription-status-card";
import { getBillingOverview } from "@/services/billing-service";
import { AXIEL_PLANS } from "@/modules/billing/plan-config";

export default async function BillingPage() {
  const { clinic, subscription } = await getBillingOverview();

  if (!clinic) redirect("/onboarding");

  const currentPlanSlug = (subscription as any)?.plans?.slug ?? null;
  const cancelAtPeriodEnd = (subscription as any)?.metadata?.cancel_at_period_end === true
    || (subscription as any)?.cancel_at_period_end === true;

  const plans = Object.values(AXIEL_PLANS);

  return (
    <Shell>
      {/* Header */}
      <div className="mb-[20px]">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[2px]">
          Conta
        </p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">
          Plano &amp; Faturamento
        </h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Gerencie seu plano AXIEL e assinatura Stripe
        </p>
      </div>

      {/* Status card */}
      <div className="mb-[20px]">
        <SubscriptionStatusCard
          planName={(subscription as any)?.plans?.name ?? null}
          status={subscription?.status ?? null}
          trialEndsAt={subscription?.trial_ends_at ?? null}
          renewsAt={subscription?.current_period_ends_at ?? null}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          hasCustomer={!!(subscription as any)?.external_customer_id}
        />
      </div>

      {/* Plans */}
      <div id="planos">
        <p className="text-[13px] font-medium text-[#0F1A2E] mb-[12px]">Escolha seu plano</p>
        <div className="grid gap-[12px] lg:grid-cols-3">
          {plans.map(plan => (
            <BillingPlanCard
              key={plan.slug}
              plan={plan}
              current={plan.slug === currentPlanSlug}
            />
          ))}
        </div>
      </div>

      {/* Trial info */}
      {!subscription && (
        <div className="mt-[16px] bg-[#F0FAF6] border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[12px]">
          <p className="text-[12px] font-semibold text-[#0F6E56] mb-[2px]">14 dias grátis em qualquer plano</p>
          <p className="text-[11px] text-[#085041]">
            Sem cartão necessário para iniciar o trial. Cancele a qualquer momento.
          </p>
        </div>
      )}

      {/* Footer note */}
      <p className="text-[10px] text-[#D3D1C7] mt-[16px]">
        Pagamentos processados com segurança pelo Stripe. Upgrade, downgrade e cancelamento disponíveis a qualquer momento via portal Stripe.
      </p>
    </Shell>
  );
}
