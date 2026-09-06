"use server";

import { revalidatePath } from "next/cache";
import { resolveLocale } from "@/i18n/get-locale";
import { createPaymentAdmin } from "@/services/finance-service";
import { getSignedDocumentUrl, createDocumentUploadTicket } from "@/services/patient-document-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { requireFinanceEdit, requireFinanceAccess } from "@/lib/require-finance-access";
import {
  generateFinanceInsight,
  type FinanceAIInsight,
} from "@/services/ai-finance-insight-service";
import type { PaymentMethod, PatientPaymentStatus } from "@/lib/types";

// Ticket de upload direto navegador→storage do comprovante de pagamento. O arquivo
// NÃO passa pela função da Vercel (corte de ~4,5 MB): o modal sobe direto e manda
// só o path pro registerPaymentAction.
export async function createPaymentProofUploadUrlAction(
  patientId: string,
  fileName: string,
): Promise<{ ok: boolean; path?: string; token?: string; error?: string }> {
  await requireFinanceEdit();
  const clinic = await getCurrentClinic();
  if (!clinic) return { ok: false, error: "Clínica não encontrada." };
  if (!patientId) return { ok: false, error: "Paciente inválido." };
  try {
    const ticket = await createDocumentUploadTicket(
      `${clinic.id}/payment-proofs/${patientId}/`,
      fileName,
    );
    return { ok: true, path: ticket.path, token: ticket.token };
  } catch {
    return { ok: false, error: "Não foi possível preparar o upload." };
  }
}

export async function registerPaymentAction(
  formData: FormData,
): Promise<{ error?: string }> {
  await requireFinanceEdit();
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
  const statusRaw     = (formData.get("status") as string | null) || "paid";
  const status: PatientPaymentStatus = statusRaw === "pending" ? "pending" : "paid";

  if (!patientId || !amountStr || !method) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  const amountCents = Math.round(parseFloat(amountStr.replace(",", ".")) * 100);
  if (isNaN(amountCents) || amountCents <= 0) {
    return { error: "Valor inválido." };
  }

  try {
    // Comprovante opcional: chega como PATH já no storage (upload direto do modal via
    // createPaymentProofUploadUrlAction). Valida o prefixo p/ não aceitar path forjado.
    let proofPath: string | null = null;
    const rawProofPath = formData.get("proof_path");
    if (typeof rawProofPath === "string" && rawProofPath.trim()) {
      if (!rawProofPath.startsWith(`${clinic.id}/payment-proofs/`)) {
        return { error: "Comprovante inválido." };
      }
      proofPath = rawProofPath;
    }

    await createPaymentAdmin({
      clinic_id:      clinic.id,
      patient_id:     patientId,
      appointment_id: appointmentId,
      amount_cents:   amountCents,
      payment_method: method,
      paid_at:        paidAt,
      notes,
      created_by:     user?.id ?? null,
      status,
      proof_path:     proofPath,
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
    // Análise INTERNA (gestor lê): idioma da clínica (locale da UI).
    const insight = await generateFinanceInsight(clinic.id, await resolveLocale());
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
  await requireFinanceEdit();
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

// Confirma um pagamento pendente (Zelle/transferência/dinheiro) como recebido.
export async function confirmPaymentAction(
  paymentId: string,
): Promise<{ error?: string }> {
  await requireFinanceEdit();
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("patient_payments")
    .update({ status: "paid", confirmed_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("clinic_id", clinic.id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/financeiro");
  return {};
}

// Descarta um pagamento pendente que nunca foi confirmado (ex: Zelle que não caiu).
export async function discardPendingPaymentAction(
  paymentId: string,
): Promise<{ error?: string }> {
  await requireFinanceEdit();
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("patient_payments")
    .delete()
    .eq("id", paymentId)
    .eq("clinic_id", clinic.id)
    .eq("status", "pending"); // só remove pendentes — nunca um pagamento confirmado

  if (error) return { error: error.message };
  revalidatePath("/financeiro");
  return {};
}

// Gera uma URL assinada (temporária) do comprovante de um pagamento.
export async function getPaymentProofUrlAction(
  paymentId: string,
): Promise<{ url?: string; error?: string }> {
  await requireFinanceAccess();
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("patient_payments")
    .select("proof_path")
    .eq("id", paymentId)
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  if (error || !data?.proof_path) return { error: "Comprovante não encontrado." };

  const url = await getSignedDocumentUrl(data.proof_path as string);
  if (!url) return { error: "Não foi possível abrir o comprovante." };
  return { url };
}
