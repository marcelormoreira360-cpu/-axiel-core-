import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { stripe, getAppUrl, paymentMethodTypesForCurrency } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RequestBody = {
  portal_token: string;
  appointment_id: string;
};

// POST /api/stripe/session-checkout
// Allows a patient to pay for a specific session directly from the portal.
// Authenticated via portal token (SHA-256 hash) — no session cookie required.
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

  const { portal_token, appointment_id } = body;
  if (!portal_token || !appointment_id) {
    return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const tokenHash = crypto.createHash("sha256").update(portal_token).digest("hex");

  // ── 1. Validate portal link ───────────────────────────────────────────────────
  const { data: link } = await supabase
    .from("patient_portal_links")
    .select("patient_id, clinic_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!link) {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }

  // ── 2. Fetch appointment + session type (must belong to this patient & clinic) ─
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, session_type_id, session_types(name, price_cents)")
    .eq("id", appointment_id)
    .eq("patient_id", link.patient_id)
    .eq("clinic_id", link.clinic_id)
    .maybeSingle();

  if (!appointment) {
    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  }

  const sessionType = (appointment.session_types as unknown) as {
    name: string;
    price_cents: number;
  } | null;

  if (!sessionType || (sessionType.price_cents ?? 0) <= 0) {
    return NextResponse.json({ error: "Esta sessão não requer pagamento." }, { status: 400 });
  }

  // ── 3. Guard: do not create a new checkout if already paid ───────────────────
  const { data: existingPayment } = await supabase
    .from("patient_payments")
    .select("id")
    .eq("appointment_id", appointment_id)
    .eq("status", "paid")
    .maybeSingle();

  if (existingPayment) {
    return NextResponse.json({ error: "Esta sessão já foi paga." }, { status: 409 });
  }

  // ── 4. Fetch clinic settings for currency ────────────────────────────────────
  const { data: clinicSettings } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", link.clinic_id)
    .maybeSingle();

  const currency = (
    (clinicSettings?.settings as Record<string, unknown> | null)?.default_currency as string | undefined
  )?.toLowerCase() ?? "brl";

  // ── 5. Fetch patient email for Stripe prefill ─────────────────────────────────
  const { data: patient } = await supabase
    .from("patients")
    .select("email")
    .eq("id", link.patient_id)
    .maybeSingle();

  const appUrl = getAppUrl();

  // ── 6. Create Stripe checkout session ────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: paymentMethodTypesForCurrency(currency),
    customer_email: (patient?.email as string | undefined) ?? undefined,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: sessionType.name,
          },
          unit_amount: sessionType.price_cents,
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/p/${portal_token}?pagamento=sucesso`,
    cancel_url: `${appUrl}/p/${portal_token}`,
    metadata: {
      type: "session_payment",
      patient_id: link.patient_id as string,
      clinic_id: link.clinic_id as string,
      appointment_id,
      // Store only the hash — the raw token stays in success/cancel URLs only.
      portal_token_hash: tokenHash,
    },
  });

  return NextResponse.json({ url: session.url });
}
