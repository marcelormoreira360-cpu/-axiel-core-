"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { emitNfse, syncNfseStatus, cancelNfse } from "@/services/nfse-service";
import type { NfseInvoice } from "@/services/nfse-service";

export async function emitNfseAction(formData: FormData): Promise<{ invoice?: NfseInvoice; error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const patientPaymentId = (formData.get("patient_payment_id") as string | null) || undefined;
  const patientId        = (formData.get("patient_id") as string | null) || undefined;
  const borrowerName     = (formData.get("borrower_name") as string ?? "").trim();
  const borrowerEmail    = (formData.get("borrower_email") as string | null) || undefined;
  const borrowerCpf      = (formData.get("borrower_cpf") as string | null) || undefined;
  const amountStr        = (formData.get("amount_cents") as string ?? "");
  const serviceDescription = (formData.get("service_description") as string | null) || undefined;

  if (!borrowerName) return { error: "Nome do tomador é obrigatório." };

  const amountCents = parseInt(amountStr, 10);
  if (isNaN(amountCents) || amountCents <= 0) return { error: "Valor inválido." };

  try {
    const invoice = await emitNfse({
      clinicId: clinic.id,
      patientPaymentId,
      patientId,
      amountCents,
      borrowerName,
      borrowerEmail,
      borrowerCpf: borrowerCpf?.replace(/\D/g, "") || undefined,
      serviceDescription,
    });
    revalidatePath("/financeiro/nfse");
    return { invoice };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao emitir nota." };
  }
}

export async function syncNfseAction(localId: string): Promise<{ error?: string }> {
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

export async function cancelNfseAction(localId: string): Promise<{ error?: string }> {
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
