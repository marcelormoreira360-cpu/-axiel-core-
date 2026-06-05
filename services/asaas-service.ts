import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { asaasFetch } from "@/lib/asaas";

type PatientForAsaas = {
  id: string;
  full_name: string;
  email: string | null;
  cpf: string | null;
  asaas_customer_id: string | null;
};

// Garante que o paciente tem um cliente no Asaas; cria se necessário e persiste o id.
export async function ensureAsaasCustomer(patient: PatientForAsaas): Promise<string> {
  if (patient.asaas_customer_id) return patient.asaas_customer_id;

  const cpfDigits = (patient.cpf ?? "").replace(/\D/g, "");
  if (!cpfDigits) {
    throw new Error("CPF do paciente é obrigatório para cobrança Pix via Asaas.");
  }

  const created = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: patient.full_name,
      cpfCnpj: cpfDigits,
      email: patient.email ?? undefined,
    }),
  });

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("patients")
    .update({ asaas_customer_id: created.id })
    .eq("id", patient.id);

  return created.id;
}

export type AsaasBillingType = "PIX" | "BOLETO";

// Cria uma cobrança única no Asaas (Pix ou Boleto). Retorna o id e a invoiceUrl
// (página hospedada com QR Code/copia-e-cola para Pix, ou o boleto).
export async function createAsaasCharge(input: {
  customerId: string;
  billingType: AsaasBillingType;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  externalReference: string;
  description: string;
}): Promise<{ asaasPaymentId: string; invoiceUrl: string }> {
  const payment = await asaasFetch<{ id: string; invoiceUrl: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.amountCents / 100,
      dueDate: input.dueDate,
      externalReference: input.externalReference,
      description: input.description,
    }),
  });

  return { asaasPaymentId: payment.id, invoiceUrl: payment.invoiceUrl };
}

// Cria uma assinatura recorrente no Asaas (mensalidade). Cada ciclo gera uma
// cobrança; a confirmação chega pelo webhook (PAYMENT_RECEIVED com subscription).
export async function createAsaasSubscription(input: {
  customerId: string;
  billingType: AsaasBillingType;
  amountCents: number;
  cycle: "MONTHLY" | "YEARLY";
  nextDueDate: string; // YYYY-MM-DD
  externalReference: string;
  description: string;
}): Promise<{ asaasSubscriptionId: string; invoiceUrl: string | null }> {
  const sub = await asaasFetch<{ id: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.amountCents / 100,
      cycle: input.cycle,
      nextDueDate: input.nextDueDate,
      externalReference: input.externalReference,
      description: input.description,
    }),
  });

  // Busca a 1ª cobrança gerada pela assinatura para devolver o link de pagamento.
  let invoiceUrl: string | null = null;
  try {
    const payments = await asaasFetch<{ data: Array<{ invoiceUrl: string }> }>(
      `/subscriptions/${sub.id}/payments`,
    );
    invoiceUrl = payments.data?.[0]?.invoiceUrl ?? null;
  } catch {
    /* link pode não estar pronto ainda; webhook reconcilia */
  }

  return { asaasSubscriptionId: sub.id, invoiceUrl };
}
