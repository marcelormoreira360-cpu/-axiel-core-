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

// Cria uma cobrança Pix no Asaas. Retorna o id da cobrança e a invoiceUrl
// (página hospedada com QR Code + copia-e-cola).
export async function createAsaasPixCharge(input: {
  customerId: string;
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  externalReference: string;
  description: string;
}): Promise<{ asaasPaymentId: string; invoiceUrl: string }> {
  const payment = await asaasFetch<{ id: string; invoiceUrl: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "PIX",
      value: input.amountCents / 100,
      dueDate: input.dueDate,
      externalReference: input.externalReference,
      description: input.description,
    }),
  });

  return { asaasPaymentId: payment.id, invoiceUrl: payment.invoiceUrl };
}
