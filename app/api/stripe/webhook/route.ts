import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";
import type { PaymentMethod } from "@/lib/types";

const log = createLogger("stripe-webhook");

export const runtime = "nodejs";

type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
};

function toTimestamp(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

// API 2025+ (Basil) moveu current_period_* da assinatura para os ITEMS; payloads
// de endpoints pinados em versões antigas ainda trazem no topo. Lê os dois.
function subscriptionPeriod(sub: Stripe.Subscription): { start?: number; end?: number } {
  const legacy = sub as StripeSubscriptionWithPeriod;
  const item = sub.items?.data?.[0] as unknown as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  return {
    start: legacy.current_period_start ?? item?.current_period_start,
    end: legacy.current_period_end ?? item?.current_period_end,
  };
}

async function syncSubscription(subscription: StripeSubscriptionWithPeriod) {
  const supabase = createSupabaseAdminClient();
  const clinicId = subscription.metadata?.clinic_id;
  const planCode = subscription.metadata?.plan_code;

  if (!clinicId || !planCode) {
    log.warn("syncSubscription: missing metadata — skipping", {
      subscription_id: subscription.id,
      has_clinic_id: !!clinicId,
      has_plan_code: !!planCode,
    });
    return;
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id")
    .eq("code", planCode)
    .maybeSingle();

  if (planError || !plan) {
    // CRITICAL: plan not found means plan_id would be null → clinic falls back to
    // "starter" even though they paid. Log as error so Sentry captures it.
    log.error("syncSubscription: plan not found in DB — subscription will have plan_id=null", planError ?? new Error("no plan row"), {
      plan_code: planCode,
      clinic_id: clinicId,
      subscription_id: subscription.id,
    });
  }

  const { error: upsertError } = await supabase.from("subscriptions").upsert(
    {
      clinic_id: clinicId,
      plan_id: plan?.id ?? null,
      status: subscription.status,
      trial_ends_at: toTimestamp(subscription.trial_end),
      current_period_starts_at: toTimestamp(subscriptionPeriod(subscription).start),
      current_period_ends_at: toTimestamp(subscriptionPeriod(subscription).end),
      external_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      external_subscription_id: subscription.id,
      metadata: {
        stripe_status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
    },
    { onConflict: "clinic_id" }
  );

  if (upsertError) {
    // Log as error — Sentry will capture this. Stripe will retry the webhook.
    log.error("syncSubscription: failed to upsert subscription", upsertError, {
      clinic_id: clinicId,
      plan_code: planCode,
      subscription_id: subscription.id,
      status: subscription.status,
    });
    // Re-throw so the webhook returns 500 and Stripe retries automatically
    throw upsertError;
  }

  log.info("syncSubscription: upserted", {
    clinic_id: clinicId,
    plan_code: planCode,
    status: subscription.status,
  });

  // ── Programa de indicação ────────────────────────────────────────────────
  // Quando a assinatura da clínica indicada vira ATIVA (paga, fora do trial):
  // marca a conversão e recompensa o indicador com 1 mês grátis, aplicando o
  // coupon STRIPE_REFERRAL_COUPON_ID na assinatura Stripe ativa dele.
  // ⚠️ O coupon precisa ser criado no painel do Stripe (100% off, duration
  // "once") e o ID setado na env. processReferralConversion nunca lança —
  // se a aplicação do coupon falhar, só loga (recompensa manual depois) e a
  // conversão fica em 'converted'.
  if (subscription.status === "active") {
    try {
      const { processReferralConversion } = await import("@/services/referral-service");
      await processReferralConversion(clinicId);
    } catch (referralError) {
      // Cinto e suspensório: referral jamais derruba o webhook de billing.
      log.warn("syncSubscription: falha no processamento de referral", {
        clinic_id: clinicId,
        error: referralError instanceof Error ? referralError.message : String(referralError),
      });
    }
  }

  await supabase.from("billing_events").insert({
    clinic_id: clinicId,
    external_subscription_id: subscription.id,
    event_type: `subscription.${subscription.status}`,
    payload: subscription as unknown as Record<string, unknown>,
  });
}

// ── Resolve o método de pagamento real (card/pix/boleto) ───────────────────────
// O checkout não traz o método escolhido; é preciso ler o PaymentIntent/charge.
async function resolveStripePaymentMethod(
  session: Stripe.Checkout.Session,
): Promise<PaymentMethod> {
  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (!piId) return "credit_card";
  try {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const type = charge?.payment_method_details?.type;
    if (type === "pix") return "pix";
    if (type === "boleto") return "boleto";
    if (type === "card") return "credit_card";
  } catch (error) {
    log.warn("resolveStripePaymentMethod: falha ao buscar PaymentIntent", {
      payment_intent: piId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return "credit_card";
}

// ── Registra o pagamento de um checkout JÁ confirmado (paid) ───────────────────
// Chamado tanto em checkout.session.completed (cartão, síncrono) quanto em
// checkout.session.async_payment_succeeded (pix/boleto, assíncrono).
// Idempotente por stripe_payment_intent_id — eventos duplicados não duplicam linhas.
async function handleCheckoutSessionPaid(session: Stripe.Checkout.Session) {
  const type = session.metadata?.type;

  // Pix/Boleto: pedido de produto só confirma via async_payment_succeeded,
  // então o pedido também precisa ser baixado aqui (service é idempotente).
  if (type === "product_order") {
    if (session.metadata?.order_id) {
      const intentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      const { markProductOrderPaid } = await import("@/services/product-order-service");
      await markProductOrderPaid(session.metadata.order_id, { stripePaymentIntentId: intentId });
    }
    return;
  }

  if (type !== "session_payment" && type !== "patient_purchase") return;

  const supabaseAdmin = createSupabaseAdminClient();
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Idempotência: se já existe pagamento para este PaymentIntent, não reprocessa.
  if (paymentIntentId) {
    const { data: existing } = await supabaseAdmin
      .from("patient_payments")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (existing) return;
  }

  const method = await resolveStripePaymentMethod(session);

  if (type === "session_payment") {
    const { patient_id, clinic_id, appointment_id } = session.metadata ?? {};
    const { error } = await supabaseAdmin.from("patient_payments").insert({
      clinic_id,
      patient_id,
      appointment_id,
      amount_cents: session.amount_total ?? 0,
      currency: session.currency?.toUpperCase() ?? "BRL",
      payment_method: method,
      paid_at: new Date().toISOString(),
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      notes: `Stripe session checkout ${session.id}`,
    });
    if (error) {
      // Re-throw → webhook devolve 500, Stripe re-tenta; a idempotência evita duplicar.
      log.error("handleCheckoutSessionPaid: falha ao inserir session_payment", error, { session_id: session.id });
      throw error;
    }
    return;
  }

  // type === "patient_purchase"
  const { patient_id, clinic_id, offer_id } = session.metadata ?? {};
  const { data: offer } = await supabaseAdmin
    .from("monetization_offers")
    .select("name, number_of_sessions, price_cents")
    .eq("id", offer_id)
    .single();

  if (!offer) {
    log.error("handleCheckoutSessionPaid: oferta não encontrada — pagamento recebido sem registro", new Error("offer not found"), {
      session_id: session.id,
      offer_id,
    });
    throw new Error(`patient_purchase: offer ${offer_id} not found for session ${session.id}`);
  }

  // Pagamento PRIMEIRO: é a âncora de idempotência (stripe_payment_intent_id).
  // Se falhar → throw → Stripe re-tenta; a checagem no topo evita duplicar.
  const { error: payError } = await supabaseAdmin.from("patient_payments").insert({
    clinic_id,
    patient_id,
    patient_offer_id: offer_id,
    amount_cents: (offer.price_cents as number) ?? session.amount_total ?? 0,
    currency: session.currency?.toUpperCase() ?? "BRL",
    payment_method: method,
    paid_at: new Date().toISOString(),
    status: "paid",
    stripe_payment_intent_id: paymentIntentId,
    notes: `Stripe checkout ${session.id}`,
  });
  if (payError) {
    log.error("handleCheckoutSessionPaid: falha ao inserir patient_payment (purchase)", payError, { session_id: session.id });
    throw payError;
  }

  // Pacote DEPOIS: pagamento já está registrado (âncora setada). Se falhar aqui,
  // apenas logamos — não relança, senão o retry pularia via idempotência e o
  // pacote ficaria faltando de qualquer forma. Caso raro e recuperável.
  const { error: pkgError } = await supabaseAdmin.from("patient_packages").insert({
    patient_id,
    clinic_id,
    name: offer.name,
    sessions_total: (offer.number_of_sessions as number | null) ?? 1,
    start_date: new Date().toISOString().slice(0, 10),
    is_active: true,
    notes: `Comprado online em ${new Date().toLocaleDateString("pt-BR")}`,
  });
  if (pkgError) {
    log.error("handleCheckoutSessionPaid: pagamento registrado mas falhou ao criar patient_package", pkgError, {
      session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    });
  }
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

    // Pagamento de sessão avulsa ou compra de pacote/oferta.
    // ⚠️ Pix e Boleto são assíncronos: a sessão "completa" com payment_status
    // diferente de "paid" (o cliente ainda vai pagar). Nesse caso NÃO registramos
    // aqui — esperamos checkout.session.async_payment_succeeded.
    // Cartão fecha como "paid" e é processado imediatamente.
    // Pedido de produtos (cartão) — dá baixa no pedido
    if (session.metadata?.type === "product_order") {
      if (session.payment_status === "paid" && session.metadata.order_id) {
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
        const { markProductOrderPaid } = await import("@/services/product-order-service");
        await markProductOrderPaid(session.metadata.order_id, { stripePaymentIntentId: paymentIntentId });
      }
      return NextResponse.json({ received: true });
    }

    if (session.metadata?.type === "session_payment" || session.metadata?.type === "patient_purchase") {
      if (session.payment_status === "paid") {
        await handleCheckoutSessionPaid(session);
      } else {
        log.info("checkout.session.completed: pagamento assíncrono pendente (pix/boleto)", {
          session_id: session.id,
          type: session.metadata?.type,
          payment_status: session.payment_status,
        });
      }
      return NextResponse.json({ received: true });
    }

    // Handle patient recurring subscription checkout
    if (session.metadata?.type === "patient_subscription" && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(String(session.subscription));
      const meta = sub.metadata ?? {};
      const supabaseAdmin = createSupabaseAdminClient();
      const { start: periodStart, end: periodEnd } = subscriptionPeriod(sub);
      await supabaseAdmin.from("patient_subscriptions").upsert(
        {
          clinic_id: meta.clinic_id,
          patient_id: meta.patient_id,
          offer_id: meta.offer_id ?? null,
          stripe_subscription_id: sub.id,
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          plan_name: meta.plan_name ?? "Plano mensal",
          amount_cents: sub.items.data[0]?.price?.unit_amount ?? 0,
          currency: (sub.currency ?? "brl").toUpperCase(),
          billing_interval: sub.items.data[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly",
          sessions_per_cycle: parseInt(meta.sessions_per_cycle ?? "0", 10),
          status: sub.status,
          current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" }
      );
      return NextResponse.json({ received: true });
    }

    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
      await syncSubscription(subscription as StripeSubscriptionWithPeriod);
    }
  }

  // Pix/Boleto confirmados (assíncrono) — aqui o pagamento realmente entrou.
  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutSessionPaid(session);
    return NextResponse.json({ received: true });
  }

  // Pix/Boleto que expiraram ou falharam — nada foi persistido como pago, então
  // só registramos para visibilidade (a sessão permanece "não paga").
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    log.warn("checkout.session.async_payment_failed: pagamento pix/boleto não concluído", {
      session_id: session.id,
      type: session.metadata?.type,
    });
    return NextResponse.json({ received: true });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.paused" ||
    event.type === "customer.subscription.resumed"
  ) {
    const sub = event.data.object as StripeSubscriptionWithPeriod;

    // Route to patient_subscriptions if this is a patient plan
    if (sub.metadata?.type === "patient_subscription") {
      const supabaseAdmin = createSupabaseAdminClient();
      await supabaseAdmin
        .from("patient_subscriptions")
        .update({
          status: sub.status,
          current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);

      // On renewal (subscription.updated with new period): reset sessions_used_this_cycle
      const prevAttr = (event.data as Stripe.Event.Data).previous_attributes as Record<string, unknown> | undefined;
      const periodChanged = prevAttr?.current_period_start !== undefined;
      if (event.type === "customer.subscription.updated" && periodChanged) {
        await supabaseAdmin
          .from("patient_subscriptions")
          .update({ sessions_used_this_cycle: 0 })
          .eq("stripe_subscription_id", sub.id);
      }
    } else {
      await syncSubscription(sub);
    }
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    // API 2025+ (Basil): a assinatura mora em invoice.parent.subscription_details.
    // Endpoints pinados em versões antigas ainda mandam invoice.subscription —
    // lemos os dois formatos para não depender da versão do painel.
    const legacySub = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
    const parentSub = invoice.parent?.subscription_details?.subscription;
    const subscriptionId =
      typeof parentSub === "string" ? parentSub
      : parentSub?.id
      ?? (typeof legacySub === "string" ? legacySub : legacySub?.id)
      ?? null;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    const supabase = createSupabaseAdminClient();

    // Check if this invoice belongs to a patient subscription
    if (subscriptionId) {
      const { data: patientSub } = await supabase
        .from("patient_subscriptions")
        .select("id, clinic_id, patient_id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      if (patientSub) {
        await supabase
          .from("patient_subscriptions")
          .update({
            status: event.type === "invoice.payment_failed" ? "past_due" : "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", patientSub.id as string);
        // Rest of invoice processing handled separately (clinic subscriptions below)
        return NextResponse.json({ received: true });
      }
    }
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("clinic_id")
      .or(`external_subscription_id.eq.${subscriptionId},external_customer_id.eq.${customerId}`)
      .maybeSingle();

    if (subscription?.clinic_id) {
      // ── BILL-04: reflect payment status in subscriptions table ──────────────
      if (event.type === "invoice.payment_failed") {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due", metadata: { stripe_status: "past_due" } })
          .eq("clinic_id", subscription.clinic_id);
      }

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

  // ── Checkout expirado (Pix/Boleto não pago a tempo) — só observabilidade ─────
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    log.info("checkout.session.expired: cobrança não paga dentro do prazo", {
      session_id: session.id,
      type: session.metadata?.type,
      payment_status: session.payment_status,
    });
    return NextResponse.json({ received: true });
  }

  // ── Disputa / chargeback aberto — alerta para a equipe (sem mudar status) ────
  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId =
      typeof dispute.payment_intent === "string"
        ? dispute.payment_intent
        : (dispute.payment_intent?.id ?? null);
    log.warn("charge.dispute.created: disputa aberta pelo cliente", {
      dispute_id: dispute.id,
      payment_intent: paymentIntentId,
      amount: dispute.amount,
      reason: dispute.reason,
    });
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
