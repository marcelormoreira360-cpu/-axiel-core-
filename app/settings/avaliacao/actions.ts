"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  createClinicAssessmentField,
  updateClinicAssessmentField,
  deleteClinicAssessmentField,
  moveClinicAssessmentField,
} from "@/services/clinic-assessment-service";
import type { AssessmentFieldType } from "@/lib/types";

export type FieldState = { ok?: boolean; error?: string } | null;

const TYPES: AssessmentFieldType[] = ["textarea", "text", "number", "select"];

function isManagerRole(role: string | null | undefined): boolean {
  return ["clinic_owner", "clinic_manager", "admin"].includes(role ?? "");
}

function parseOptions(type: AssessmentFieldType, formData: FormData) {
  if (type === "select") {
    const choices = String(formData.get("choices") ?? "")
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    return choices.length > 0 ? { choices } : null;
  }
  if (type === "number") {
    const min = String(formData.get("min") ?? "").trim();
    const max = String(formData.get("max") ?? "").trim();
    const out: { min?: number; max?: number } = {};
    if (min !== "" && Number.isFinite(Number(min))) out.min = Number(min);
    if (max !== "" && Number.isFinite(Number(max))) out.max = Number(max);
    return Object.keys(out).length > 0 ? out : null;
  }
  return null;
}

export async function createAssessmentFieldAction(
  _prev: FieldState,
  formData: FormData,
): Promise<FieldState> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { error: "Não autorizado." };
  if (!isManagerRole(profile.role)) return { error: "Sem permissão." };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Informe o nome do campo." };

  const rawType = String(formData.get("field_type") ?? "textarea");
  const field_type: AssessmentFieldType = TYPES.includes(rawType as AssessmentFieldType)
    ? (rawType as AssessmentFieldType)
    : "textarea";

  try {
    await createClinicAssessmentField({
      clinic_id: profile.clinic_id,
      label,
      field_type,
      placeholder: String(formData.get("placeholder") ?? "").trim() || null,
      help_text: String(formData.get("help_text") ?? "").trim() || null,
      options: parseOptions(field_type, formData),
      include_in_report: formData.get("include_in_report") === "on",
    });
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/settings/avaliacao");
  return { ok: true };
}

export async function updateAssessmentFieldAction(
  _prev: FieldState,
  formData: FormData,
): Promise<FieldState> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { error: "Não autorizado." };
  if (!isManagerRole(profile.role)) return { error: "Sem permissão." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Campo inválido." };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Informe o nome do campo." };

  const rawType = String(formData.get("field_type") ?? "textarea");
  const field_type: AssessmentFieldType = TYPES.includes(rawType as AssessmentFieldType)
    ? (rawType as AssessmentFieldType)
    : "textarea";

  try {
    await updateClinicAssessmentField(id, {
      label,
      field_type,
      placeholder: String(formData.get("placeholder") ?? "").trim() || null,
      help_text: String(formData.get("help_text") ?? "").trim() || null,
      options: parseOptions(field_type, formData),
      include_in_report: formData.get("include_in_report") === "on",
    });
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/settings/avaliacao");
  return { ok: true };
}

export async function toggleAssessmentFieldActiveAction(id: string, isActive: boolean) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManagerRole(profile.role)) throw new Error("Sem permissão.");
  await updateClinicAssessmentField(id, { is_active: isActive });
  revalidatePath("/settings/avaliacao");
}

export async function deleteAssessmentFieldAction(id: string) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManagerRole(profile.role)) throw new Error("Sem permissão.");
  await deleteClinicAssessmentField(id);
  revalidatePath("/settings/avaliacao");
}

export async function moveAssessmentFieldAction(id: string, direction: "up" | "down") {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManagerRole(profile.role)) throw new Error("Sem permissão.");
  await moveClinicAssessmentField(profile.clinic_id, id, direction);
  revalidatePath("/settings/avaliacao");
}
