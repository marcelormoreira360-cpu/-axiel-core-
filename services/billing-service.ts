import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient as createClient } from "@/lib/supabase-server";
import { getPlanConfig } from "@/modules/billing/plan-config";
import type { ClinicBillingContext } from "@/modules/billing/feature-access";

// Two-layer cache strategy:
//   1. unstable_cache (2 min TTL) — persists across requests, avoids DB on every page load
//   2. React.cache wrapper — deduplicates multiple calls within the same request
// IMPORTANT: uses admin client — unstable_cache callbacks run outside request context,
// so cookies() (createSupabaseServerClient) are unavailable here.

async function _fetchSubscription(clinicId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) { console.error("getClinicSubscription error", error); return null; }
  return data;
}

const _fetchSubscriptionCached = unstable_cache(
  _fetchSubscription,
  ["clinic-subscription"],
  { revalidate: 120, tags: ["clinic-subscription"] },
);

export const getClinicSubscription = cache(async (clinicId: string) => {
  return _fetchSubscriptionCached(clinicId);
});

/** Call after Stripe webhook updates the subscription row. */
export function invalidateBillingCache() {
  revalidateTag("clinic-subscription", {});
}

export const getClinicPlanContext = cache(async (clinicId: string) => {
  const subscription = await getClinicSubscription(clinicId);
  // BILL-07: 'code' is the canonical identifier (NOT NULL unique in DB).
  // 'slug' is an alias added in 007 — prefer 'code' so fresh and migrated DBs
  // resolve the same value; fall back to 'slug' for older rows, then 'starter'.
  const plans = subscription?.plans as { slug?: string | null; code?: string | null } | null;
  const planSlug = plans?.code ?? plans?.slug ?? "starter";

  return {
    subscription,
    plan: getPlanConfig(planSlug),
  };
});

/**
 * Returns a ClinicBillingContext for use with canUseFeature / checkUsageLimit.
 * Pass optional usage counts when you need to enforce numeric limits.
 * Cached per clinicId per request — safe to call from every feature gate.
 */
export const getBillingContext = cache(async (
  clinicId: string,
  usage?: ClinicBillingContext["usage"],
): Promise<ClinicBillingContext> => {
  const { plan } = await getClinicPlanContext(clinicId);
  return { planSlug: plan.slug, usage };
});

export async function getCurrentUserForBilling() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getBillingOverview() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { clinic: null, plans: [], subscription: null };

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id, clinics(*)")
    .eq("id", user.id)
    .maybeSingle();

  const clinic = profile?.clinics ?? null;
  const clinicId = profile?.clinic_id ?? null;

  const subscription = clinicId ? await getClinicSubscription(clinicId) : null;

  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("price_cents", { ascending: true });

  return { clinic, plans: plans ?? [], subscription };
}

// QA-04: seedDefaultPlans was previously exported but never called from app code.
// Plans are seeded via supabase/migrations/007_pricing_v2.sql. Removed to avoid
// accidental runtime invocation and duplicate DB writes.

// ─── Subscription Cancellation ────────────────────────────────────────────────

/**
 * Cancels a clinic subscription at the end of the current billing period.
 * The subscription remains active until `current_period_ends_at`.
 * Pass `immediately = true` to cancel right now (no proration refund issued here).
 */
export async function cancelClinicSubscription(
  clinicId: string,
  options: { immediately?: boolean } = {}
): Promise<{ cancelledAt: string | null; endsAt: string | null }> {
  const { stripe } = await import("@/lib/stripe");
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("external_subscription_id, current_period_ends_at")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!sub?.external_subscription_id) {
    throw new Error("Subscrição Stripe não encontrada para esta clínica.");
  }

  let cancelled: import("stripe").Stripe.Subscription;

  if (options.immediately) {
    cancelled = await stripe.subscriptions.cancel(sub.external_subscription_id);
  } else {
    cancelled = await stripe.subscriptions.update(sub.external_subscription_id, {
      cancel_at_period_end: true,
    });
  }

  // Reflect in DB immediately (webhook will also update)
  await supabase
    .from("subscriptions")
    .update({
      metadata: {
        stripe_status: cancelled.status,
        cancel_at_period_end: cancelled.cancel_at_period_end,
      },
    })
    .eq("clinic_id", clinicId);

  return {
    cancelledAt: options.immediately ? new Date().toISOString() : null,
    endsAt: sub.current_period_ends_at ?? null,
  };
}

/**
 * Reactivates a subscription that was set to cancel_at_period_end.
 */
export async function reactivateClinicSubscription(clinicId: string): Promise<void> {
  const { stripe } = await import("@/lib/stripe");
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("external_subscription_id")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!sub?.external_subscription_id) {
    throw new Error("Subscrição Stripe não encontrada para esta clínica.");
  }

  await stripe.subscriptions.update(sub.external_subscription_id, {
    cancel_at_period_end: false,
  });

  await supabase
    .from("subscriptions")
    .update({
      metadata: { cancel_at_period_end: false },
    })
    .eq("clinic_id", clinicId);
}
