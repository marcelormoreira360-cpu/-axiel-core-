"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createPaymentAdmin } from "@/services/finance-service";
import { getCurrentClinic } from "@/services/clinic-service";
import type { PaymentMethod } from "@/lib/types";

export async function registerPaymentAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const patientId     = formData.get("patient_id") as string;
  const appointmentId = (formData.get("appointment_id") as string | null) || null;
  const amountStr     = formData.get("amount") as string;
  const method        = formData.get("payment_method") as PaymentMethod;
  const paidAt        = (formData.get("paid_at") as string) || new Date().toISOString();
  const notes         = (formData.get("notes") as string | null) || null;

  if (!patientId || !amountStr || !method) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  const amountCents = Math.round(parseFloat(amountStr.replace(",", ".")) * 100);
  if (isNaN(amountCents) || amountCents <= 0) {
    return { error: "Valor inválido." };
  }

  try {
    await createPaymentAdmin({
      clinic_id:      clinic.id,
      patient_id:     patientId,
      appointment_id: appointmentId,
      amount_cents:   amountCents,
      payment_method: method,
      paid_at:        paidAt,
      notes,
      created_by:     user?.id ?? null,
    });

    revalidatePath("/financeiro");
    revalidatePath(`/patients/${patientId}`);
    if (appointmentId) revalidatePath(`/schedule/${appointmentId}/session`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao registrar pagamento." };
  }
}

export async function deletePaymentAction(
  paymentId: string,
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("patient_payments")
    .delete()
    .eq("id", paymentId)
    .eq("clinic_id", clinic.id);

  if (error) return { error: error.message };
  revalidatePath("/financeiro");
  return {};
}
