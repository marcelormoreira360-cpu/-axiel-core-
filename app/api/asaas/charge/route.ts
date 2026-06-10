import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentClinic } from "@/services/clinic-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { isAsaasConfigured } from "@/lib/asaas";
import { ensureAsaasCustomer, createAsaasCharge, type AsaasBillingType } from "@/services/asaas-service";

export const runtime = "nodejs";

type RequestBody = {
  appointment_id: string;
  billing_type?: AsaasBillingType;
};

// POST /api/asaas/charge
// Gera uma cobrança Pix (via Asaas) para uma sessão, a partir do painel da clínica.
// Grava patient_payments como 'pending'; o webhook do Asaas confirma como 'paid'.
export async function POST(request: Request) {
  if (!isAsaasConfigured()) {
    return NextResponse.json({ error: "Asaas não configurado." }, { status: 500 });
  }

  const clinic = await getCurrentClinic();
  if (!clinic) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Pix/Boleto (Asaas) só existem em BRL/Brasil. Bloqueia clínicas USD/EUR.
  if ((await (await import("@/services/finance-service")).getClinicCurrency(clinic.id)) !== "BRL") {
    return NextResponse.json({ error: "Pix/Boleto disponível apenas para clínicas em BRL." }, { status: 400 });
  }

  if (!(await checkRateLimitDb(`asaas-charge:${clinic.id}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { appointment_id } = body;
  const billingType: AsaasBillingType = body.billing_type === "BOLETO" ? "BOLETO" : "PIX";
  if (!appointment_id) {
    return NextResponse.json({ error: "appointment_id obrigatório." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Agendamento da clínica + tipo de sessão (preço) + paciente
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, session_types(name, price_cents), patients(id, full_name, email, cpf, asaas_customer_id)")
    .eq("id", appointment_id)
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  if (!appointment) {
    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  }

  const sessionType = (appointment.session_types as unknown) as { name: string; price_cents: number } | null;
  if (!sessionType || (sessionType.price_cents ?? 0) <= 0) {
    return NextResponse.json({ error: "Esta sessão não tem valor definido." }, { status: 400 });
  }

  // Guarda: já paga?
  const { data: existingPaid } = await supabase
    .from("patient_payments")
    .select("id")
    .eq("appointment_id", appointment_id)
    .eq("status", "paid")
    .maybeSingle();
  if (existingPaid) {
    return NextResponse.json({ error: "Esta sessão já foi paga." }, { status: 409 });
  }

  const patient = (appointment.patients as unknown) as {
    id: string; full_name: string; email: string | null; cpf: string | null; asaas_customer_id: string | null;
  } | null;
  if (!patient) {
    return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  }

  try {
    const customerId = await ensureAsaasCustomer(patient);

    // Pix vence hoje; boleto damos 3 dias.
    const due = new Date();
    if (billingType === "BOLETO") due.setDate(due.getDate() + 3);
    const dueDate = due.toISOString().slice(0, 10);

    const { asaasPaymentId, invoiceUrl } = await createAsaasCharge({
      customerId,
      billingType,
      amountCents: sessionType.price_cents,
      dueDate,
      externalReference: appointment_id,
      description: sessionType.name,
    });

    // Registra como pendente (idempotente por asaas_payment_id)
    const { error: insErr } = await supabase.from("patient_payments").insert({
      clinic_id: clinic.id,
      patient_id: patient.id,
      appointment_id,
      amount_cents: sessionType.price_cents,
      currency: "BRL",
      payment_method: billingType === "BOLETO" ? "boleto" : "pix",
      status: "pending",
      paid_at: new Date().toISOString(),
      asaas_payment_id: asaasPaymentId,
      notes: `Cobrança Pix Asaas ${asaasPaymentId}`,
    });
    if (insErr) {
      // CRÍTICO: sem registro local, o paciente pagaria uma cobrança "fantasma".
      // Cancela a cobrança no Asaas (best-effort) e retorna erro — fix auditoria 10/06/2026.
      console.error("asaas/charge: falha ao gravar patient_payments pending", insErr);
      try {
        const { asaasFetch } = await import("@/lib/asaas");
        await asaasFetch(`/payments/${asaasPaymentId}`, { method: "DELETE" });
      } catch (cancelErr) {
        console.error("asaas/charge: falha ao cancelar cobrança órfã", asaasPaymentId, cancelErr);
      }
      return NextResponse.json(
        { error: "Erro ao registrar a cobrança. Nenhum link foi enviado — tente novamente." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: invoiceUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar cobrança Pix." },
      { status: 400 },
    );
  }
}
