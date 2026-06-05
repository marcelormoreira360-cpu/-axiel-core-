import { NextResponse } from "next/server";
import { stripe, getAppUrl } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentClinic } from "@/services/clinic-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";

export const runtime = "nodejs";

type RequestBody = {
  patient_id: string;
  offer_id: string;
};

// POST /api/finance/charge-offer
// A clínica (staff) gera um link de pagamento para uma oferta:
//   - session_package → pagamento único (cartão/Pix/Boleto), metadata patient_purchase
//   - membership      → assinatura recorrente (só cartão), metadata patient_subscription
// O registro (patient_packages / patient_subscriptions / patient_payments) é feito
// pelo webhook do Stripe, reaproveitando os handlers já existentes.
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  const clinic = await getCurrentClinic();
  if (!clinic) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // 60 links de cobrança por minuto por clínica
  if (!(await checkRateLimitDb(`charge-offer:${clinic.id}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { patient_id, offer_id } = body;
  if (!patient_id || !offer_id) {
    return NextResponse.json({ error: "patient_id e offer_id são obrigatórios." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Oferta precisa ser ativa e da clínica do staff
  const { data: offer } = await supabase
    .from("monetization_offers")
    .select("id, name, description, price_cents, currency, offer_type, billing_interval, number_of_sessions, clinic_id")
    .eq("id", offer_id)
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!offer) {
    return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
  }

  if ((offer.price_cents as number ?? 0) <= 0) {
    return NextResponse.json({ error: "Esta oferta não tem valor definido." }, { status: 400 });
  }

  // Paciente precisa pertencer à mesma clínica
  const { data: patient } = await supabase
    .from("patients")
    .select("id, email")
    .eq("id", patient_id)
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  if (!patient) {
    return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  }

  const appUrl = getAppUrl();
  const currency = ((offer.currency as string | null) ?? "BRL").toLowerCase();
  const successUrl = `${appUrl}/pagamento/sucesso`;
  const cancelUrl = `${appUrl}/pagamento/sucesso?status=cancelado`;
  const description = (offer.description as string | null) ?? undefined;

  // ── Mensalidade (assinatura recorrente) — só cartão ──────────────────────────
  if (offer.offer_type === "membership") {
    const { data: existing } = await supabase
      .from("patient_subscriptions")
      .select("id")
      .eq("patient_id", patient_id)
      .eq("clinic_id", clinic.id)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Este paciente já tem um plano ativo.", code: "already_subscribed" },
        { status: 409 },
      );
    }

    const interval = (offer.billing_interval as string | null) === "yearly" ? "year" : "month";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: (patient.email as string | undefined) ?? undefined,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: offer.name as string, ...(description ? { description } : {}) },
            unit_amount: offer.price_cents as number,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          type: "patient_subscription",
          patient_id,
          clinic_id: clinic.id,
          offer_id,
          plan_name: offer.name as string,
          sessions_per_cycle: String(offer.number_of_sessions ?? 0),
        },
      },
      metadata: {
        type: "patient_subscription",
        patient_id,
        clinic_id: clinic.id,
        offer_id,
      },
    });

    return NextResponse.json({ url: session.url, kind: "subscription" });
  }

  // ── Pacote de sessões (pagamento único) — cartão/Pix/Boleto ──────────────────
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Métodos dinâmicos (ver session-checkout): Stripe decide pelo painel + moeda.
    customer_email: (patient.email as string | undefined) ?? undefined,
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: offer.name as string, ...(description ? { description } : {}) },
          unit_amount: offer.price_cents as number,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "patient_purchase",
      patient_id,
      clinic_id: clinic.id,
      offer_id,
    },
  });

  return NextResponse.json({ url: session.url, kind: "payment" });
}
