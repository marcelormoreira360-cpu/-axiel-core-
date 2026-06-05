import { NextResponse } from "next/server";
import { stripe, getAppUrl } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentClinic } from "@/services/clinic-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";

export const runtime = "nodejs";

type RequestBody = { order_id: string };

// POST /api/stripe/order-checkout — cobra um pedido de produtos via Stripe (cartão).
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe não configurado." }, { status: 500 });

  const clinic = await getCurrentClinic();
  if (!clinic) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await checkRateLimitDb(`order-checkout:${clinic.id}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  let body: RequestBody;
  try { body = (await request.json()) as RequestBody; } catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }
  const { order_id } = body;
  if (!order_id) return NextResponse.json({ error: "order_id obrigatório." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: order } = await supabase
    .from("product_orders")
    .select("id, total_cents, currency, payment_status, patients(email)")
    .eq("id", order_id)
    .eq("clinic_id", clinic.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ error: "Pedido já pago." }, { status: 409 });
  if ((order.total_cents as number ?? 0) <= 0) return NextResponse.json({ error: "Pedido sem valor." }, { status: 400 });

  const patient = (order.patients as unknown) as { email?: string } | null;
  const appUrl = getAppUrl();
  const currency = ((order.currency as string | null) ?? "BRL").toLowerCase();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: patient?.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: `Pedido de produtos ${String(order_id).slice(0, 8)}` },
          unit_amount: order.total_cents as number,
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/pagamento/sucesso`,
    cancel_url: `${appUrl}/pagamento/sucesso?status=cancelado`,
    metadata: { type: "product_order", order_id, clinic_id: clinic.id },
  });

  return NextResponse.json({ url: session.url });
}
