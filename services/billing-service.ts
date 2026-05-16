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
  const planSlug = subscription?.plans?.slug ?? "starter";

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
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    price_cents: plan.priceCents,
    billing_interval: plan.billingInterval,
    features: plan.features,
    limits: plan.limits,
    is_active: true,
  }));

  const { error } = await supabase.from("plans").upsert(rows, { onConflict: "slug" });

  if (error) {
    console.error("seedDefaultPlans error", error);
  }
}
