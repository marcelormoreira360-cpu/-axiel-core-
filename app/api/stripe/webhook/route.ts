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

    // Handle patient package purchase
    if (session.metadata?.type === "patient_purchase") {
      const { patient_id, clinic_id, offer_id } = session.metadata;

      const supabaseAdmin = createSupabaseAdminClient();
      const { data: offer } = await supabaseAdmin
        .from("monetization_offers")
        .select("name, number_of_sessions, price_cents")
        .eq("id", offer_id)
        .single();

      if (offer) {
        // Retrieve payment intent ID from the session for future refunds
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);

        // Create patient package
        await supabaseAdmin.from("patient_packages").insert({
          patient_id,
          clinic_id,
          name: offer.name,
          sessions_total: (offer.number_of_sessions as number | null) ?? 1,
          start_date: new Date().toISOString().slice(0, 10),
          is_active: true,
          auto_renew: false,
          notes: `Comprado online em ${new Date().toLocaleDateString("pt-BR")}`,
        });

        // Create patient_payment record linked to this Stripe payment
        await supabaseAdmin.from("patient_payments").insert({
          clinic_id,
          patient_id,
          patient_offer_id: offer_id,
          amount_cents: (offer.price_cents as number) ?? session.amount_total ?? 0,
          currency: (session.currency?.toUpperCase() ?? "BRL"),
          payment_method: "credit_card",
          paid_at: new Date().toISOString(),
          status: "paid",
          stripe_payment_intent_id: paymentIntentId,
          notes: `Stripe checkout ${session.id}`,
        });
      }

      return NextResponse.json({ received: true });
    }

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

  // ── Refund tracking ────────────────────────────────────────────────────────
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : (charge.payment_intent?.id ?? null);

    if (paymentIntentId) {
      const supabase = createSupabaseAdminClient();
      const isFullRefund = charge.amount_refunded >= charge.amount;

      await supabase
        .from("patient_payments")
        .update({
          status: isFullRefund ? "refunded" : "partially_refunded",
          refunded_at: new Date().toISOString(),
          refund_amount_cents: charge.amount_refunded,
        })
        .eq("stripe_payment_intent_id", paymentIntentId);
    }
  }

  return NextResponse.json({ received: true });
}
