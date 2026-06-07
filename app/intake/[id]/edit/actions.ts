"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { updateIntakeFormWithQuestions } from "@/services/intake-service";
import type { IntakeQuestionType } from "@/lib/types";

export type IntakeEditState = { ok?: boolean; error?: string } | null;

const VALID_TYPES: IntakeQuestionType[] = ["short_text", "long_text", "number", "date", "yes_no"];

export async function updateIntakeFormAction(formData: FormData): Promise<IntakeEditState> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { error: "Não autorizado." };
  if (!["clinic_owner", "clinic_manager", "admin"].includes(profile.role ?? "")) {
    return { error: "Sem permissão." };
  }

  const formId = String(formData.get("form_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!formId || !name) return { error: "Dados obrigatórios ausentes." };

  let questions: { dbId: string | null; label: string; question_type: IntakeQuestionType; is_required: boolean; display_order: number }[] = [];
  let deletedIds: string[] = [];
  try {
    const rawQ = JSON.parse(String(formData.get("questions") ?? "[]"));
    const rawD = JSON.parse(String(formData.get("deleted_question_ids") ?? "[]"));
    if (Array.isArray(rawQ)) {
      questions = rawQ
        .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
        .map((q, i) => ({
          dbId: typeof q.dbId === "string" ? q.dbId : null,
          label: String(q.label ?? "").trim(),
          question_type: VALID_TYPES.includes(q.question_type as IntakeQuestionType) ? (q.question_type as IntakeQuestionType) : "long_text",
          is_required: q.is_required === true,
          display_order: typeof q.display_order === "number" ? q.display_order : i,
        }))
        .filter((q) => q.label);
    }
    if (Array.isArray(rawD)) deletedIds = rawD.filter((x): x is string => typeof x === "string");
  } catch {
    return { error: "Dados inválidos." };
  }

  try {
    await updateIntakeFormWithQuestions({
      form_id: formId,
      name,
      description,
      questions,
      deleted_question_ids: deletedIds,
    });
  } catch {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/intake");
  revalidatePath(`/intake/${formId}/edit`);
  return { ok: true };
}
