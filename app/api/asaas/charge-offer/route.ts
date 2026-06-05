import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentClinic } from "@/services/clinic-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { isAsaasConfigured } from "@/lib/asaas";
import { ensureAsaasCustomer, createAsaasCharge, createAsaasSubscription, type AsaasBillingType } from "@/services/asaas-service";

export const runtime = "nodejs";

type RequestBody = {
  patient_id: string;
  offer_id: string;
  billing_type?: AsaasBillingType;
};

// POST /api/asaas/charge-offer
// Cobra uma oferta via Asaas: session_package → cobrança única (Pix/Boleto);
// membership → assinatura recorrente. Retorna o link de pagamento (invoiceUrl).
export async function POST(request: Request) {
  if (!isAsaasConfigured()) {
    return NextResponse.json({ error: "Asaas não configurado." }, { status: 500 });
  }

  const clinic = await getCurrentClinic();
  if (!clinic) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Pix/Boleto (Asaas) só existem em BRL/Brasil. Bloqueia clínicas USD/EUR.
  if ((await (await import("@/services/finance-service")).getClinicCurrency(clinic.id)) !== "BRL") {
    return NextResponse.json({ error: "Pix/Boleto disponível apenas para clínicas em BRL." }, { status: 400 });
  }

  if (!(await checkRateLimitDb(`asaas-charge-offer:${clinic.id}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { patient_id, offer_id } = body;
  const billingType: AsaasBillingType = body.billing_type === "BOLETO" ? "BOLETO" : "PIX";
  if (!patient_id || !offer_id) {
    return NextResponse.json({ error: "patient_id e offer_id são obrigatórios." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: offer } = await supabase
    .from("monetization_offers")
    .select("id, name, price_cents, offer_type, billing_interval, number_of_sessions, clinic_id")
    .eq("id", offer_id)
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!offer) return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
  if ((offer.price_cents as number ?? 0) <= 0) {
    return NextResponse.json({ error: "Esta oferta não tem valor definido." }, { status: 400 });
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, email, cpf, asaas_customer_id")
    .eq("id", patient_id)
    .eq("clinic_id", clinic.id)
    .maybeSingle();
  if (!patient) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });

  try {
    const customerId = await ensureAsaasCustomer(patient);

    // ── Mensalidade: assinatura recorrente ────────────────────────────────────
    if (offer.offer_type === "membership") {
      const { data: existing } = await supabase
        .from("patient_subscriptions")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("clinic_id", clinic.id)
        .in("status", ["active", "trialing", "past_due"])
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: "Este paciente já tem um plano ativo.", code: "already_subscribed" }, { status: 409 });
      }

      const cycle = (offer.billing_interval as string | null) === "yearly" ? "YEARLY" : "MONTHLY";
      const nextDueDate = new Date(Date.now() + (billingType === "BOLETO" ? 3 : 0) * 86400000)
        .toISOString().slice(0, 10);

      const { asaasSubscriptionId, invoiceUrl } = await createAsaasSubscription({
        customerId,
        billingType,
        amountCents: offer.price_cents as number,
        cycle,
        nextDueDate,
        externalReference: `${patient_id}:${offer_id}`,
        description: offer.name as string,
      });

      await supabase.from("patient_subscriptions").insert({
        clinic_id: clinic.id,
        patient_id,
        offer_id,
        asaas_subscription_id: asaasSubscriptionId,
        plan_name: offer.name,
        amount_cents: offer.price_cents,
        currency: "BRL",
        billing_interval: cycle === "YEARLY" ? "yearly" : "monthly",
        sessions_per_cycle: offer.number_of_sessions ?? 0,
        status: "active",
      });

      return NextResponse.json({ url: invoiceUrl, kind: "subscription" });
    }

    // ── Pacote: cobrança única ────────────────────────────────────────────────
    const due = new Date();
    if (billingType === "BOLETO") due.setDate(due.getDate() + 3);
    const dueDate = due.toISOString().slice(0, 10);

    const { asaasPaymentId, invoiceUrl } = await createAsaasCharge({
      customerId,
      billingType,
      amountCents: offer.price_cents as number,
      dueDate,
      externalReference: `${patient_id}:${offer_id}`,
      description: offer.name as string,
    });

    await supabase.from("patient_payments").insert({
      clinic_id: clinic.id,
      patient_id,
      patient_offer_id: offer_id,
      amount_cents: offer.price_cents,
      currency: "BRL",
      payment_method: billingType === "BOLETO" ? "boleto" : "pix",
      status: "pending",
      paid_at: new Date().toISOString(),
      asaas_payment_id: asaasPaymentId,
      notes: `Cobrança ${billingType} Asaas (oferta) ${asaasPaymentId}`,
    });

    return NextResponse.json({ url: invoiceUrl, kind: "payment" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar cobrança." }, { status: 400 });
  }
}
