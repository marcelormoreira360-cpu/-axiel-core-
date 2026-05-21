"use server";

import { revalidatePath } from "next/cache";
import { createPaymentAdmin } from "@/services/finance-service";
import { getCurrentClinic } from "@/services/clinic-service";
import {
  generateFinanceInsight,
  type FinanceAIInsight,
} from "@/services/ai-finance-insight-service";
import type { PaymentMethod } from "@/lib/types";

export async function registerPaymentAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");


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

export async function generateFinanceInsightAction(): Promise<{
  insight?: FinanceAIInsight;
  error?: string;
}> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  try {
    const insight = await generateFinanceInsight(clinic.id);
    return { insight };
  } catch (e: unknown) {
    let msg = "Erro ao gerar análise.";
    if (e instanceof Error) {
      msg = e.message;
    } else if (e && typeof e === "object") {
      const obj = e as Record<string, unknown>;
      if (typeof obj.message === "string") msg = obj.message;
      else if (typeof obj.error === "string") msg = obj.error;
      else msg = JSON.stringify(e);
    } else if (typeof e === "string") {
      msg = e;
    }
    // Surface clearly that OPENAI_API_KEY may be missing
    if (!process.env.OPENAI_API_KEY) {
      msg = "OPENAI_API_KEY não configurada. Adicione a chave nas variáveis de ambiente do projeto.";
    }
    return { error: msg };
  }
}

export async function deletePaymentAction(
  paymentId: string,
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");


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
