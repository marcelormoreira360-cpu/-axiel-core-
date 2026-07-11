import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BillingPlanCard } from "@/components/billing-plan-card";
import { SubscriptionStatusCard } from "@/components/subscription-status-card";
import { getBillingOverview } from "@/services/billing-service";
import { AXIEL_PLANS } from "@/modules/billing/plan-config";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

// QA-03: explicit shape for the joined subscription row returned by getBillingOverview
type SubscriptionRow = {
  status: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  external_customer_id: string | null;
  cancel_at_period_end: boolean | null;
  metadata: { cancel_at_period_end?: boolean } | null;
  plans: { slug: string | null; code: string | null; name: string | null } | null;
};

export default async function BillingPage() {
  const t = await getTranslations("billing");
  const { clinic, subscription: rawSub } = await getBillingOverview();
  const subscription = rawSub as SubscriptionRow | null;

  if (!clinic) redirect("/onboarding");

  const currentPlanSlug = subscription?.plans?.code ?? subscription?.plans?.slug ?? null;
  const cancelAtPeriodEnd = subscription?.metadata?.cancel_at_period_end === true
    || subscription?.cancel_at_period_end === true;

  const plans = Object.values(AXIEL_PLANS);

  // Buscar faturas Stripe se o cliente já tem um external_customer_id
  let invoices: Stripe.Invoice[] = [];
  const customerId = subscription?.external_customer_id;
  if (customerId && process.env.STRIPE_SECRET_KEY) {
    try {
      const result = await stripe.invoices.list({ customer: customerId, limit: 8 });
      invoices = result.data;
    } catch {
      // Stripe indisponível ou key inválida — ignora silenciosamente
    }
  }

  return (
    <Shell billingLockExempt>
      {/* Header */}
      <div className="mb-[20px]">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[2px]">
          {t("eyebrow")}
        </p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">
          {t("title")}
        </h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          {t("subtitle")}
        </p>
      </div>

      {/* Status card */}
      <div className="mb-[20px]">
        <SubscriptionStatusCard
          planName={subscription?.plans?.name ?? null}
          status={subscription?.status ?? null}
          trialEndsAt={subscription?.trial_ends_at ?? null}
          renewsAt={subscription?.current_period_ends_at ?? null}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          hasCustomer={!!subscription?.external_customer_id}
        />
      </div>

      {/* Plans */}
      <div id="planos">
        <p className="text-[13px] font-medium text-[#0F1A2E] mb-[12px]">{t("choosePlan")}</p>
        <div className="grid gap-[12px] sm:grid-cols-2 xl:grid-cols-4">
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
          <p className="text-[12px] font-semibold text-[#0F6E56] mb-[2px]">{t("trialTitle")}</p>
          <p className="text-[11px] text-[#085041]">
            {t("trialSubtitle")}
          </p>
        </div>
      )}

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div className="mt-[22px]">
          <p className="text-[13px] font-medium text-[#0F1A2E] mb-[12px]">{t("invoiceHistory")}</p>
          <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
            <div className="divide-y divide-black/[.04]">
              {invoices.map((inv) => {
                const date = inv.created
                  ? new Date(inv.created * 1000).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
                  : "—";
                const amount = typeof inv.amount_paid === "number"
                  ? (inv.amount_paid / 100).toLocaleString("pt-BR", { style: "currency", currency: inv.currency?.toUpperCase() ?? "BRL" })
                  : "—";
                const statusMap: Record<string, { label: string; classes: string }> = {
                  paid:   { label: t("status.paid"),     classes: "bg-[#E1F5EE] text-[#085041]" },
                  open:   { label: t("status.open"),   classes: "bg-[#FAEEDA] text-[#633806]" },
                  void:   { label: t("status.void"),classes: "bg-[#F4F3EF] text-[#6B6A66]" },
                  draft:  { label: t("status.draft"), classes: "bg-[#F4F3EF] text-[#6B6A66]" },
                  uncollectible: { label: t("status.uncollectible"), classes: "bg-[#FEE2E2] text-red-700" },
                };
                const badge = statusMap[inv.status ?? ""] ?? { label: inv.status ?? "—", classes: "bg-[#F4F3EF] text-[#6B6A66]" };
                return (
                  <div key={inv.id} className="flex items-center gap-[12px] px-[16px] py-[11px]">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#0F1A2E]">{date}</p>
                      {inv.description && (
                        <p className="text-[10px] text-[#A09E98] truncate">{inv.description}</p>
                      )}
                    </div>
                    <span className={`text-[10px] px-[8px] py-[2px] rounded-full font-medium ${badge.classes}`}>
                      {badge.label}
                    </span>
                    <p className="text-[13px] font-medium text-[#0F1A2E] shrink-0">{amount}</p>
                    {inv.invoice_pdf && (
                      <a
                        href={inv.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[11px] text-[#0F6E56] hover:underline"
                        title={t("downloadPdf")}
                      >
                        PDF
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <p className="text-[10px] text-[#D3D1C7] mt-[16px]">
        {t("footer")}
      </p>
    </Shell>
  );
}
