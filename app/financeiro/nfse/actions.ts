"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { emitNfse, syncNfseStatus, cancelNfse } from "@/services/nfse-service";
import { validateCpf } from "@/lib/utils";
import type { NfseInvoice } from "@/services/nfse-service";

export async function emitNfseAction(
  formData: FormData
): Promise<{ invoice?: NfseInvoice; error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const patientPaymentId =
    (formData.get("patient_payment_id") as string | null) || undefined;
  const patientId = (formData.get("patient_id") as string | null) || undefined;
  const borrowerName = (formData.get("borrower_name") as string ?? "").trim();
  const borrowerEmail =
    (formData.get("borrower_email") as string | null) || undefined;
  const borrowerCpfRaw =
    (formData.get("borrower_cpf") as string | null) || undefined;
  // amount_reais: accepts "200.00" or "200,00" → convert to cents
  const amountStr = (formData.get("amount_reais") as string ?? "").replace(",", ".");
  const serviceDescription =
    (formData.get("service_description") as string | null) || undefined;

  if (!borrowerName) return { error: "Nome do tomador é obrigatório." };

  const amountReais = parseFloat(amountStr);
  if (isNaN(amountReais) || amountReais <= 0)
    return { error: "Valor inválido. Informe um valor positivo em reais (ex: 200,00)." };

  const amountCents = Math.round(amountReais * 100);

  // ── Se houver pagamento vinculado, ele precisa existir, ser da clínica e estar
  //    confirmado (paid). NFSe avulsa (sem vínculo) continua permitida. ──────────
  if (patientPaymentId) {
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const supabase = await createSupabaseServerClient();
    const { data: payment } = await supabase
      .from("patient_payments")
      .select("status")
      .eq("id", patientPaymentId)
      .eq("clinic_id", clinic.id)
      .maybeSingle();
    if (!payment) {
      return { error: "Pagamento vinculado não encontrado." };
    }
    if (payment.status !== "paid") {
      return { error: "Só é possível emitir NFS-e para pagamento confirmado (status pago)." };
    }
  }

  // ── CPF validation ──────────────────────────────────────────────────────────
  let borrowerCpf: string | undefined;
  if (borrowerCpfRaw) {
    const cpfDigits = borrowerCpfRaw.replace(/\D/g, "");
    if (cpfDigits.length > 0) {
      if (!validateCpf(cpfDigits)) {
        return { error: "CPF inválido. Verifique os dígitos informados." };
      }
      borrowerCpf = cpfDigits;
    }
  }

  try {
    const invoice = await emitNfse({
      clinicId: clinic.id,
      patientPaymentId,
      patientId,
      amountCents,
      borrowerName,
      borrowerEmail,
      borrowerCpf,
      serviceDescription,
    });
    revalidatePath("/financeiro/nfse");
    return { invoice };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir nota." };
  }
}

export async function syncNfseAction(
  localId: string
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  try {
    await syncNfseStatus(clinic.id, localId);
    revalidatePath("/financeiro/nfse");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao sincronizar." };
  }
}

export async function cancelNfseAction(
  localId: string
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  try {
    await cancelNfse(clinic.id, localId);
    revalidatePath("/financeiro/nfse");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao cancelar." };
  }
}
