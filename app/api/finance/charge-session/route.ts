import { NextResponse } from "next/server";
import { stripe, getAppUrl } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentClinic } from "@/services/clinic-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";

export const runtime = "nodejs";

type RequestBody = {
  appointment_id: string;
};

// POST /api/finance/charge-session
// Gera um link de pagamento Stripe para uma sessão, a partir do painel da clínica
// (staff autenticado). O link pode ser copiado e enviado ao paciente.
// O pagamento é registrado pelo webhook (type=session_payment), incluindo Pix/Boleto.
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });
  }

  // 1. Autenticação: precisa ser staff de uma clínica
  const clinic = await getCurrentClinic();
  if (!clinic) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // 60 links de cobrança por minuto por clínica
  if (!(await checkRateLimitDb(`charge-session:${clinic.id}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { appointment_id } = body;
  if (!appointment_id) {
    return NextResponse.json({ error: "appointment_id obrigatório." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 2. Agendamento precisa pertencer à clínica do staff (evita cobrança cross-clinic)
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, session_types(name, price_cents)")
    .eq("id", appointment_id)
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  if (!appointment) {
    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  }

  const sessionType = (appointment.session_types as unknown) as {
    name: string;
    price_cents: number;
  } | null;

  if (!sessionType || (sessionType.price_cents ?? 0) <= 0) {
    return NextResponse.json({ error: "Esta sessão não tem valor definido." }, { status: 400 });
  }

  // 3. Guarda: não gerar cobrança se já está paga
  const { data: existingPayment } = await supabase
    .from("patient_payments")
    .select("id")
    .eq("appointment_id", appointment_id)
    .eq("status", "paid")
    .maybeSingle();

  if (existingPayment) {
    return NextResponse.json({ error: "Esta sessão já foi paga." }, { status: 409 });
  }

  // 4. Moeda da clínica (define se Pix/Boleto entram)
  const { data: clinicSettings } = await supabase
    .from("clinic_settings")
    .select("default_currency, settings")
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  // Fonte única = coluna default_currency; JSON é fallback legado.
  const currency = (
    (clinicSettings?.default_currency as string | null) ??
    ((clinicSettings?.settings as Record<string, unknown> | null)?.default_currency as string | undefined) ??
    "BRL"
  ).toLowerCase();

  // 5. E-mail do paciente (prefill no checkout)
  const { data: patient } = await supabase
    .from("patients")
    .select("email")
    .eq("id", appointment.patient_id)
    .maybeSingle();

  const appUrl = getAppUrl();

  // 6. Cria a sessão de checkout
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Métodos dinâmicos (ver session-checkout): Stripe decide pelo painel + moeda.
      customer_email: (patient?.email as string | undefined) ?? undefined,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: sessionType.name },
            unit_amount: sessionType.price_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/pagamento/sucesso`,
      cancel_url: `${appUrl}/pagamento/sucesso?status=cancelado`,
      metadata: {
        type: "session_payment",
        patient_id: appointment.patient_id as string,
        clinic_id: clinic.id,
        appointment_id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    // Surfacing the real Stripe reason (chave inválida, conta restrita, URL inválida, método/moeda…)
    const msg = e instanceof Error ? e.message : "Erro ao criar cobrança no Stripe.";
    console.error("[charge-session] Stripe error:", msg);
    return NextResponse.json({ error: `Stripe: ${msg}` }, { status: 502 });
  }
}
