"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  createTreatmentPlan,
  updateTreatmentPlanStatus,
  addTreatmentPlanStep,
  toggleTreatmentPlanStep,
  deleteTreatmentPlanStep,
} from "@/services/treatment-plan-service";

// ── Create plan ───────────────────────────────────────────────────────────────

export async function createTreatmentPlanAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId    = String(formData.get("patient_id") ?? "");
  const title        = String(formData.get("title") ?? "").trim();
  const goal         = String(formData.get("goal") ?? "").trim() || null;
  const targetEndAt  = String(formData.get("target_end_at") ?? "").trim() || null;
  const notes        = String(formData.get("notes") ?? "").trim() || null;

  if (!title || !patientId) return;

  await createTreatmentPlan({
    clinic_id:     profile.clinic_id,
    patient_id:    patientId,
    created_by:    profile.id,
    title,
    goal,
    target_end_at: targetEndAt,
    notes,
  });

  revalidatePath(`/patients/${patientId}`);
}

// ── Update status ─────────────────────────────────────────────────────────────

export async function updatePlanStatusAction(
  planId: string,
  patientId: string,
  status: "active" | "paused" | "completed" | "cancelled",
) {
  await updateTreatmentPlanStatus(planId, status);
  revalidatePath(`/patients/${patientId}`);
}

// ── Add step ──────────────────────────────────────────────────────────────────

export async function addPlanStepAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const planId      = String(formData.get("plan_id") ?? "");
  const patientId   = String(formData.get("patient_id") ?? "");
  const title       = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const dueDate     = String(formData.get("due_date") ?? "").trim() || null;
  const orderIndex  = parseInt(String(formData.get("order_index") ?? "0"), 10);

  if (!title || !planId) return;

  await addTreatmentPlanStep({
    plan_id:     planId,
    clinic_id:   profile.clinic_id,
    title,
    description,
    order_index: orderIndex,
    due_date:    dueDate,
  });

  revalidatePath(`/patients/${patientId}`);
}

// ── Toggle step ───────────────────────────────────────────────────────────────

export async function toggleStepAction(
  stepId: string,
  patientId: string,
  completed: boolean,
) {
  await toggleTreatmentPlanStep(stepId, completed);
  revalidatePath(`/patients/${patientId}`);
}

// ── Delete step ───────────────────────────────────────────────────────────────

export async function deleteStepAction(stepId: string, patientId: string) {
  await deleteTreatmentPlanStep(stepId);
  revalidatePath(`/patients/${patientId}`);
}
