"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { approveAiInsightAsFinal, generateAndSaveAiInsight, requestAiInsightChanges, sendApprovedInsightToPatient } from "@/services/ai-insight-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";
import { sendPushToPatient } from "@/services/push-service";

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Extrai a causa real de erros do Supabase/PostgREST (objetos com message/code/details/hint). */
function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint, e.code].filter(Boolean).join(" · ") || JSON.stringify(error).slice(0, 300);
  }
  return "Unknown error.";
}

export async function generateAiInsightAction(patientId: string) {
  // ── Feature gate: ai_insights ─────────────────────────────────────────────
  const clinic = await getCurrentClinic();
  if (clinic) {
    const billingCtx = await getBillingContext(clinic.id);
    if (!canUseFeature(billingCtx, "ai_insights")) {
      redirect(`/patients/${patientId}/insights?error=${encodeURIComponent("Insights com IA disponíveis no plano Professional ou superior.")}`);
    }
  }

  try {
    await generateAndSaveAiInsight(patientId);
  } catch (error) {
    redirect(`/patients/${patientId}/insights?error=${encodeURIComponent(describeError(error))}`);
  }

  revalidatePath(`/patients/${patientId}/insights`);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}/insights?generated=1`);
}

export async function approveAiInsightAction(patientId: string, aiInsightId: string, formData: FormData) {
  try {
    await approveAiInsightAsFinal({
      aiInsightId,
      reviewerNotes: fieldValue(formData, "reviewer_notes"),
      changesMade: fieldValue(formData, "changes_made"),
    });
  } catch (error) {
    redirect(`/patients/${patientId}/insights?error=${encodeURIComponent(describeError(error))}`);
  }

  revalidatePath(`/patients/${patientId}/insights`);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/reports/clinical-insight`);

  // Notify patient on their device (non-blocking — fire-and-forget)
  sendPushToPatient(patientId, {
    title: "Atualização de saúde",
    body:  "Seu profissional revisou e aprovou um novo insight sobre sua saúde.",
    tag:   `insight-approved-${patientId}`,
  }).catch(() => {});

  // Envio automático ao paciente (e-mail + WhatsApp) — só se o checkbox estiver marcado.
  // Default: enviar (campo ausente quando desmarcado num <input type=checkbox>).
  const sendToPatient = formData.get("send_to_patient");
  if (sendToPatient === "on" || sendToPatient === "true") {
    sendApprovedInsightToPatient(patientId).catch(() => {});
  }

  redirect(`/patients/${patientId}/insights?approved=1&suggest_followup=1`);
}

export async function requestAiInsightChangesAction(patientId: string, aiInsightId: string, formData: FormData) {
  try {
    await requestAiInsightChanges({
      aiInsightId,
      reviewerNotes: fieldValue(formData, "reviewer_notes"),
      changesMade: fieldValue(formData, "changes_made"),
    });
  } catch (error) {
    redirect(`/patients/${patientId}/insights?error=${encodeURIComponent(describeError(error))}`);
  }

  revalidatePath(`/patients/${patientId}/insights`);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}/insights?changes=1`);
}
