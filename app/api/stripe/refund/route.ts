import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RefundRequest = {
  payment_id: string;        // local patient_payments.id
  amount_cents?: number;     // partial refund amount; omit for full refund
  reason?: string;           // 'duplicate' | 'fraudulent' | 'requested_by_customer'
};

export async function POST(req: NextRequest) {
  // ── Auth: must be authenticated clinic staff ────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  // ── Parse request ───────────────────────────────────────────────────────────
  let body: RefundRequest;
  try {
    body = (await req.json()) as RefundRequest;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { payment_id, amount_cents, reason } = body;
  if (!payment_id) {
    return NextResponse.json({ error: "payment_id é obrigatório." }, { status: 400 });
  }

  // ── Fetch the payment (scoped to clinic) ───────────────────────────────────
  const adminSupabase = createSupabaseAdminClient();
  const { data: payment, error: fetchError } = await adminSupabase
    .from("patient_payments")
    .select("id, clinic_id, amount_cents, status, stripe_payment_intent_id")
    .eq("id", payment_id)
    .eq("clinic_id", profile.clinic_id)   // RLS: only own clinic
    .maybeSingle();

  if (fetchError || !payment) {
    return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
  }

  if (payment.status === "refunded") {
    return NextResponse.json({ error: "Este pagamento já foi reembolsado." }, { status: 409 });
  }

  if (!payment.stripe_payment_intent_id) {
    return NextResponse.json(
      { error: "Este pagamento não tem referência Stripe — reembolse manualmente." },
      { status: 422 }
    );
  }

  // ── Execute refund via Stripe ───────────────────────────────────────────────
  try {
    const refundParams: import("stripe").Stripe.RefundCreateParams = {
      payment_intent: payment.stripe_payment_intent_id,
      ...(amount_cents ? { amount: amount_cents } : {}),
      ...(reason ? { reason: reason as "duplicate" | "fraudulent" | "requested_by_customer" } : {}),
    };

    const refund = await stripe.refunds.create(refundParams);

    // Optimistically update local record (webhook will also confirm)
    const isFullRefund = !amount_cents || amount_cents >= payment.amount_cents;
    await adminSupabase
      .from("patient_payments")
      .update({
        status: isFullRefund ? "refunded" : "partially_refunded",
        refunded_at: new Date().toISOString(),
        refund_amount_cents: refund.amount,
      })
      .eq("id", payment_id);

    return NextResponse.json({
      refund_id: refund.id,
      amount_refunded: refund.amount,
      status: refund.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar reembolso.";
    console.error("Stripe refund error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
