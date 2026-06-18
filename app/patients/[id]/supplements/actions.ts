"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { getPatientById } from "@/services/patient-service";
import {
  createSupplementRecommendation,
  addSupplementRecommendationItem,
  deleteSupplementRecommendationItem,
  deleteSupplementRecommendation,
  approveSupplementRecommendation,
  type SupplementOutputType,
} from "@/services/supplement-service";

const OUTPUT_TYPES: SupplementOutputType[] = ["br_formula", "us_link"];

export async function createSupplementRecommendationAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  if (!patientId) throw new Error("Paciente obrigatório");

  // Hardening: garante que o paciente pertence à clínica do usuário (RLS-scoped).
  const patient = await getPatientById(patientId, profile.clinic_id);
  if (!patient) throw new Error("Paciente não encontrado nesta clínica.");

  const rawType = String(formData.get("output_type") ?? "br_formula");
  const outputType: SupplementOutputType = OUTPUT_TYPES.includes(rawType as SupplementOutputType)
    ? (rawType as SupplementOutputType)
    : "br_formula";

  await createSupplementRecommendation({
    clinic_id:         profile.clinic_id,
    patient_id:        patientId,
    output_type:       outputType,
    rationale_summary: String(formData.get("rationale_summary") ?? "").trim() || null,
    created_by:        profile.id,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function addSupplementItemAction(formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const patientId = String(formData.get("patient_id") ?? "");
  const recommendationId = String(formData.get("recommendation_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!patientId || !recommendationId) throw new Error("Recomendação obrigatória");
  if (!name) throw new Error("Informe o nome do suplemento.");

  await addSupplementRecommendationItem({
    recommendation_id: recommendationId,
    catalog_id:        String(formData.get("catalog_id") ?? "").trim() || null,
    name,
    dosage:            String(formData.get("dosage") ?? "").trim() || null,
    timing:            String(formData.get("timing") ?? "").trim() || null,
    duration:          String(formData.get("duration") ?? "").trim() || null,
    rationale:         String(formData.get("rationale") ?? "").trim() || null,
    buy_url:           String(formData.get("buy_url") ?? "").trim() || null,
    source_country:    String(formData.get("source_country") ?? "").trim() || null,
    sort_order:        parseInt(String(formData.get("sort_order") ?? "0"), 10) || 0,
  });

  revalidatePath(`/patients/${patientId}`);
}

export async function deleteSupplementItemAction(itemId: string, patientId: string) {
  await deleteSupplementRecommendationItem(itemId);
  revalidatePath(`/patients/${patientId}`);
}

export async function deleteSupplementRecommendationAction(recId: string, patientId: string) {
  await deleteSupplementRecommendation(recId);
  revalidatePath(`/patients/${patientId}`);
}

/** Gate de aprovação humana — sem isto nenhuma saída vai ao paciente. */
export async function approveSupplementRecommendationAction(recId: string, patientId: string) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");
  await approveSupplementRecommendation(recId, profile.id);
  revalidatePath(`/patients/${patientId}`);
}
