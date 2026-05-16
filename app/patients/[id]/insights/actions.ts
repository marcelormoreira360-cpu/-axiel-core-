"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { approveAiInsightAsFinal, generateAndSaveAiInsight, requestAiInsightChanges } from "@/services/ai-insight-service";

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function generateAiInsightAction(patientId: string) {
  try {
    await generateAndSaveAiInsight(patientId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    redirect(`/patients/${patientId}/insights?error=${encodeURIComponent(message)}`);
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
    const message = error instanceof Error ? error.message : "Unknown error.";
    redirect(`/patients/${patientId}/insights?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/patients/${patientId}/insights`);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/reports/clinical-insight`);
  redirect(`/patients/${patientId}/insights?approved=1`);
}

export async function requestAiInsightChangesAction(patientId: string, aiInsightId: string, formData: FormData) {
  try {
    await requestAiInsightChanges({
      aiInsightId,
      reviewerNotes: fieldValue(formData, "reviewer_notes"),
      changesMade: fieldValue(formData, "changes_made"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    redirect(`/patients/${patientId}/insights?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/patients/${patientId}/insights`);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}/insights?changes=1`);
}
