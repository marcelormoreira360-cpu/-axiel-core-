import { NextResponse } from "next/server";
import { stripe, getAppUrl, getStripePriceId } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserForBilling } from "@/services/billing-service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const planCode = String(formData.get("planCode") ?? "");

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
  }

  const clinic = await getCurrentClinic();
  const user = await getCurrentUserForBilling();

  if (!clinic || !user?.email) {
    return NextResponse.redirect(`${getAppUrl()}/onboarding`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("code, trial_days")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  }

  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("external_customer_id, status")
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  // BILL-08 / A-03: block duplicate checkout for active, trialing, OR past_due.
  // past_due means a subscription already exists but payment failed — the correct
  // action is to fix the payment method via the billing portal, not create a 2nd sub.
  const blockedStatuses = ["active", "trialing", "past_due"];
  if (existingSubscription?.status && blockedStatuses.includes(existingSubscription.status)) {
    const suffix = existingSubscription.status === "past_due" ? "past_due" : "already_subscribed";
    return NextResponse.redirect(`${getAppUrl()}/billing?info=${suffix}`, 303);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existingSubscription?.external_customer_id ?? undefined,
    customer_email: existingSubscription?.external_customer_id ? undefined : user.email,
    line_items: [{ price: getStripePriceId(plan.code), quantity: 1 }],
    success_url: `${getAppUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppUrl()}/billing`,
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: plan.trial_days ?? undefined,
      metadata: {
        clinic_id: clinic.id,
        plan_code: plan.code,
      },
    },
    metadata: {
      clinic_id: clinic.id,
      plan_code: plan.code,
      user_id: user.id,
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }

  return NextResponse.redirect(session.url, 303);
}
