import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { stripe, getAppUrl, paymentMethodTypesForCurrency } from "@/lib/stripe";
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
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { offer_id, portal_token } = body;

  if (!offer_id || !portal_token) {
    return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 1. Validate portal token + look up the offer in parallel
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
      .select("id, name, description, price_cents, currency, clinic_id")
      .eq("id", offer_id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (linkError || !link) {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }

  if (offerError || !offer) {
    return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
  }

  // 2. Verify the offer belongs to the same clinic as the portal token.
  //    Prevents a valid token from Clinic A purchasing an offer from Clinic B.
  if (offer.clinic_id !== link.clinic_id) {
    return NextResponse.json({ error: "Oferta não disponível." }, { status: 403 });
  }

  // 3. Get patient email
  const { data: patient } = await supabase
    .from("patients")
    .select("email")
    .eq("id", link.patient_id)
    .limit(1)
    .maybeSingle();

  const appUrl = getAppUrl();
  const currency = (offer.currency as string | null)?.toLowerCase() || "brl";

  // 4. Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: paymentMethodTypesForCurrency(currency),
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
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/p/${portal_token}?compra=sucesso`,
    cancel_url: `${appUrl}/p/${portal_token}`,
    metadata: {
      type: "patient_purchase",
      patient_id: link.patient_id as string,
      clinic_id: link.clinic_id as string,
      offer_id,
      // B-05: store only the SHA-256 hash, never the raw token.
      // The webhook only needs patient_id/clinic_id/offer_id (all already present).
      // The raw token is in success_url/cancel_url (visible only to the payer).
      portal_token_hash: tokenHash,
    },
  });

  return NextResponse.json({ url: session.url });
}
