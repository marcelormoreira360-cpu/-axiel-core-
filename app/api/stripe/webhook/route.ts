import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
};

function toTimestamp(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function syncSubscription(subscription: StripeSubscriptionWithPeriod) {
  const supabase = createSupabaseAdminClient();
  const clinicId = subscription.metadata?.clinic_id;
  const planCode = subscription.metadata?.plan_code;

  if (!clinicId || !planCode) return;

  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("code", planCode)
    .maybeSingle();

  await supabase.from("subscriptions").upsert(
    {
      clinic_id: clinicId,
      plan_id: plan?.id ?? null,
      status: subscription.status,
      trial_ends_at: toTimestamp(subscription.trial_end),
      current_period_starts_at: toTimestamp(subscription.current_period_start),
      current_period_ends_at: toTimestamp(subscription.current_period_end),
      external_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      external_subscription_id: subscription.id,
      metadata: {
        stripe_status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
    },
    { onConflict: "clinic_id" }
  );

  await supabase.from("billing_events").insert({
    clinic_id: clinicId,
    external_subscription_id: subscription.id,
    event_type: `subscription.${subscription.status}`,
    payload: subscription as unknown as Record<string, unknown>,
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook configuration." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
      await syncSubscription(subscription as StripeSubscriptionWithPeriod);
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.paused" ||
    event.type === "customer.subscription.resumed"
  ) {
    await syncSubscription(event.data.object as StripeSubscriptionWithPeriod);
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    const supabase = createSupabaseAdminClient();
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("clinic_id")
      .or(`external_subscription_id.eq.${subscriptionId},external_customer_id.eq.${customerId}`)
      .maybeSingle();

    if (subscription?.clinic_id) {
      await supabase.from("billing_events").insert({
        clinic_id: subscription.clinic_id,
        external_subscription_id: subscriptionId,
        event_type: event.type,
        payload: invoice as unknown as Record<string, unknown>,
      });
    }
  }

  return NextResponse.json({ received: true });
}
