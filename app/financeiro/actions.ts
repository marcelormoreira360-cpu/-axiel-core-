"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { resolveLocale } from "@/i18n/get-locale";
import { createPaymentAdmin } from "@/services/finance-service";
import { getSignedDocumentUrl } from "@/services/patient-document-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  generateFinanceInsight,
  type FinanceAIInsight,
} from "@/services/ai-finance-insight-service";
import type { PaymentMethod, PatientPaymentStatus } from "@/lib/types";

const PROOF_BUCKET = "patient-docs";

// Faz upload de um comprovante (imagem/PDF) e devolve o caminho no storage.
async function uploadProof(file: File, clinicId: string, patientId: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const filePath = `${clinicId}/payment-proofs/${patientId}/${randomUUID()}-${safeName}`;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(filePath, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw error;
  return filePath;
}

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
    // Comprovante opcional (imagem/PDF)
    let proofPath: string | null = null;
    const proof = formData.get("proof");
    if (proof instanceof File && proof.size > 0) {
      if (proof.size > 10 * 1024 * 1024) {
        return { error: "Comprovante muito grande (máx. 10MB)." };
      }
      proofPath = await uploadProof(proof, clinic.id, patientId);
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
