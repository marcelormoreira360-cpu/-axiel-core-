import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentClinic } from "@/services/clinic-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { isAsaasConfigured } from "@/lib/asaas";
import { ensureAsaasCustomer, createAsaasCharge, type AsaasBillingType } from "@/services/asaas-service";

export const runtime = "nodejs";

type RequestBody = { order_id: string; billing_type?: AsaasBillingType };

// POST /api/asaas/charge-order — cobra um pedido de produtos via Asaas (Pix/Boleto).
export async function POST(request: Request) {
  if (!isAsaasConfigured()) return NextResponse.json({ error: "Asaas não configurado." }, { status: 500 });

  const clinic = await getCurrentClinic();
  if (!clinic) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await checkRateLimitDb(`asaas-charge-order:${clinic.id}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  let body: RequestBody;
  try { body = (await request.json()) as RequestBody; } catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }
  const { order_id } = body;
  const billingType: AsaasBillingType = body.billing_type === "BOLETO" ? "BOLETO" : "PIX";
  if (!order_id) return NextResponse.json({ error: "order_id obrigatório." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: order } = await supabase
    .from("product_orders")
    .select("id, patient_id, total_cents, payment_status, patients(id, full_name, email, cpf, asaas_customer_id)")
    .eq("id", order_id)
    .eq("clinic_id", clinic.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ error: "Pedido já pago." }, { status: 409 });
  if ((order.total_cents as number ?? 0) <= 0) return NextResponse.json({ error: "Pedido sem valor." }, { status: 400 });

  const patient = (order.patients as unknown) as { id: string; full_name: string; email: string | null; cpf: string | null; asaas_customer_id: string | null } | null;
  if (!patient) return NextResponse.json({ error: "Pedido sem paciente — Pix/Boleto via Asaas exige um paciente com CPF." }, { status: 400 });

  try {
    const customerId = await ensureAsaasCustomer(patient);
    const due = new Date();
    if (billingType === "BOLETO") due.setDate(due.getDate() + 3);
    const dueDate = due.toISOString().slice(0, 10);

    const { asaasPaymentId, invoiceUrl } = await createAsaasCharge({
      customerId,
      billingType,
      amountCents: order.total_cents as number,
      dueDate,
      externalReference: order_id,
      description: `Pedido de produtos ${String(order_id).slice(0, 8)}`,
    });

    await supabase
      .from("product_orders")
      .update({ asaas_payment_id: asaasPaymentId, status: "pending", updated_at: new Date().toISOString() })
      .eq("id", order_id);

    return NextResponse.json({ url: invoiceUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar cobrança." }, { status: 400 });
  }
}
