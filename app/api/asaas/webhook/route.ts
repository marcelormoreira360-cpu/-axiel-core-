import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("asaas-webhook");

export const runtime = "nodejs";

// Eventos do Asaas: https://docs.asaas.com/docs/fluxos-de-webhook
type AsaasWebhook = {
  event: string;
  payment?: {
    id: string;
    value?: number;
    externalReference?: string;
    status?: string;
    subscription?: string;
    billingType?: string;
  };
};

// POST /api/asaas/webhook
// Asaas envia o token configurado no painel no header `asaas-access-token`.
export async function POST(request: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const token = request.headers.get("asaas-access-token");
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  let body: AsaasWebhook;
  try {
    body = (await request.json()) as AsaasWebhook;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const asaasPaymentId = body.payment?.id;
  if (!asaasPaymentId) {
    return NextResponse.json({ received: true });
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Erro transitório de banco: responde 5xx para o Asaas reentregar o evento,
  // em vez de degradar silenciosamente para "não encontrado".
  const dbFailure = (step: string, error: { message: string }) => {
    log.error(`asaas webhook: falha de banco (${step})`, {
      asaas_payment_id: asaasPaymentId,
      error: error.message,
    });
    return NextResponse.json({ error: "Erro temporário." }, { status: 500 });
  };

  // Pagamento confirmado → marca como pago (idempotente)
  if (body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") {
    const { data: existing, error: existingError } = await supabase
      .from("patient_payments")
      .select("id, status")
      .eq("asaas_payment_id", asaasPaymentId)
      .maybeSingle();
    if (existingError) return dbFailure("busca patient_payments", existingError);

    if (existing) {
      if (existing.status !== "paid") {
        // não sobrescreve payment_method — já foi gravado certo na criação (pix/boleto)
        const { error: updateError } = await supabase
          .from("patient_payments")
          .update({ status: "paid", paid_at: nowIso, confirmed_at: nowIso })
          .eq("id", existing.id as string);
        if (updateError) return dbFailure("update patient_payments", updateError);
      }
      return NextResponse.json({ received: true });
    }

    // Pedido de produtos (cobrado via /api/asaas/charge-order)
    const { data: order, error: orderError } = await supabase
      .from("product_orders")
      .select("id")
      .eq("asaas_payment_id", asaasPaymentId)
      .maybeSingle();
    if (orderError) return dbFailure("busca product_orders", orderError);
    if (order) {
      const { markProductOrderPaid } = await import("@/services/product-order-service");
      await markProductOrderPaid(order.id as string);
      return NextResponse.json({ received: true });
    }

    // Pagamento de assinatura recorrente: não há linha pendente pré-criada.
    const asaasSubId = body.payment?.subscription;
    if (asaasSubId) {
      const { data: sub, error: subError } = await supabase
        .from("patient_subscriptions")
        .select("clinic_id, patient_id")
        .eq("asaas_subscription_id", asaasSubId)
        .maybeSingle();
      if (subError) return dbFailure("busca patient_subscriptions", subError);
      if (sub) {
        const method = body.payment?.billingType === "BOLETO" ? "boleto" : "pix";
        const { error: insertError } = await supabase.from("patient_payments").insert({
          clinic_id: sub.clinic_id,
          patient_id: sub.patient_id,
          amount_cents: Math.round((body.payment?.value ?? 0) * 100),
          currency: "BRL",
          payment_method: method,
          status: "paid",
          paid_at: nowIso,
          confirmed_at: nowIso,
          asaas_payment_id: asaasPaymentId,
          notes: `Mensalidade Asaas (assinatura ${asaasSubId})`,
        });
        if (insertError) return dbFailure("insert patient_payments", insertError);
        await supabase
          .from("patient_subscriptions")
          .update({ status: "active", updated_at: nowIso })
          .eq("asaas_subscription_id", asaasSubId);
        return NextResponse.json({ received: true });
      }
    }

    // Sem registro pendente e sem assinatura — loga para conferência.
    log.warn("asaas webhook: pagamento confirmado sem patient_payments correspondente", {
      asaas_payment_id: asaasPaymentId,
      external_reference: body.payment?.externalReference,
    });
    return NextResponse.json({ received: true });
  }

  // Reembolso
  if (body.event === "PAYMENT_REFUNDED") {
    const { error: refundError } = await supabase
      .from("patient_payments")
      .update({ status: "refunded", refunded_at: nowIso })
      .eq("asaas_payment_id", asaasPaymentId);
    if (refundError) return dbFailure("update reembolso", refundError);
    return NextResponse.json({ received: true });
  }

  // Outros eventos (PAYMENT_CREATED, PAYMENT_OVERDUE, etc.) — só observabilidade
  log.info("asaas webhook: evento não tratado", { event: body.event, asaas_payment_id: asaasPaymentId });
  return NextResponse.json({ received: true });
}
