import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { stripe, getAppUrl } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RequestBody = {
  offer_id: string;
  portal_token: string;
};

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const { offer_id, portal_token } = body;
  if (!offer_id || !portal_token) {
    return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const tokenHash = crypto.createHash("sha256").update(portal_token).digest("hex");

  const [
    { data: link, error: linkError },
    { data: offer, error: offerError },
  ] = await Promise.all([
    supabase
      .from("patient_portal_links")
      .select("patient_id, clinic_id")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
    supabase
      .from("monetization_offers")
      .select("id, name, description, price_cents, currency, clinic_id, offer_type, billing_interval, number_of_sessions")
      .eq("id", offer_id)
      .eq("is_active", true)
      .eq("offer_type", "membership")
      .maybeSingle(),
  ]);

  if (linkError || !link) {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }

  if (offerError || !offer) {
    return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  }

  if (offer.clinic_id !== link.clinic_id) {
    return NextResponse.json({ error: "Plano não disponível." }, { status: 403 });
  }

  // Block if already has an active/trialing subscription for this clinic
  const { data: existing } = await supabase
    .from("patient_subscriptions")
    .select("id, status")
    .eq("patient_id", link.patient_id as string)
    .eq("clinic_id", link.clinic_id as string)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Você já tem um plano ativo nesta clínica.", code: "already_subscribed" },
      { status: 409 }
    );
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("email, full_name")
    .eq("id", link.patient_id as string)
    .maybeSingle();

  const interval = (offer.billing_interval as string | null) === "yearly" ? "year" : "month";
  const currency = ((offer.currency as string | null) ?? "BRL").toLowerCase();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: (patient?.email as string | undefined) ?? undefined,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: offer.name as string,
            ...(offer.description ? { description: offer.description as string } : {}),
          },
          unit_amount: offer.price_cents as number,
          recurring: { interval },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/p/${portal_token}?assinatura=sucesso`,
    cancel_url: `${appUrl}/p/${portal_token}`,
    subscription_data: {
      metadata: {
        type: "patient_subscription",
        patient_id: link.patient_id as string,
        clinic_id: link.clinic_id as string,
        offer_id,
        plan_name: offer.name as string,
        sessions_per_cycle: String(offer.number_of_sessions ?? 0),
      },
    },
    metadata: {
      type: "patient_subscription",
      patient_id: link.patient_id as string,
      clinic_id: link.clinic_id as string,
      offer_id,
    },
  });

  return NextResponse.json({ url: session.url });
}
