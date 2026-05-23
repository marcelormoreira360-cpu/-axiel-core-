import { createSupabaseServerClient as createClient } from "@/lib/supabase-server";
import { AXIEL_PLANS, getPlanConfig } from "@/modules/billing/plan-config";

export async function getClinicSubscription(clinicId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) {
    console.error("getClinicSubscription error", error);
    return null;
  }

  return data;
}

export async function getClinicPlanContext(clinicId: string) {
  const subscription = await getClinicSubscription(clinicId);
  const plans = subscription?.plans as { slug?: string | null; code?: string | null } | null;
  const planSlug = plans?.slug ?? plans?.code ?? "starter";

  return {
    subscription,
    plan: getPlanConfig(planSlug),
  };
}

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

export async function seedDefaultPlans() {
  const supabase = await createClient();

  const rows = Object.values(AXIEL_PLANS).map((plan) => ({
    code:             plan.slug,   // DB uses "code" as the unique identifier
    slug:             plan.slug,
    name:             plan.name,
    description:      plan.description,
    price_cents:      plan.priceCents ?? 0,
    currency:         "BRL",
    price_usd_cents:  plan.priceUsdCents,
    price_eur_cents:  plan.priceEurCents,
    billing_interval: plan.billingInterval,
    recommended:      plan.recommended ?? false,
    features:         plan.features,
    limits:           plan.limits,
    is_active:        true,
  }));

  const { error } = await supabase.from("plans").upsert(rows, { onConflict: "code" });

  if (error) {
    console.error("seedDefaultPlans error", error);
  }
}

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
