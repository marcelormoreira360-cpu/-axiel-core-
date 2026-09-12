"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { isManager } from "@/lib/team-utils";
import {
  createSessionTypeCategory,
  updateSessionTypeCategory,
  deleteSessionTypeCategory,
  reorderSessionTypeCategories,
  setSessionTypeCategory,
  setSessionTypeColorOverride,
} from "@/services/session-type-category-service";
import { normalizeHexColor, normalizeIconName } from "@/lib/schedule-category-options";

export type CategoryState = { ok?: boolean; error?: string } | null;

async function requireManager() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id || !isManager(profile.role)) return null;
  return profile.clinic_id;
}

// ── Categorias ─────────────────────────────────────────────────────────────────

export async function createCategoryAction(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const clinicId = await requireManager();
  if (!clinicId) return { error: "Sem permissão." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome da categoria." };

  const color = normalizeHexColor(String(formData.get("color") ?? ""));
  if (!color) return { error: "Escolha uma cor válida." };

  const icon = normalizeIconName(String(formData.get("icon") ?? ""));

  try {
    await createSessionTypeCategory({ clinic_id: clinicId, name, color, icon });
  } catch (e) {
    const err = e as { code?: string } | null;
    if (err?.code === "23505") return { error: "Já existe uma categoria com esse nome." };
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/settings/categorias-agenda");
  return { ok: true };
}

export async function updateCategoryAction(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  const clinicId = await requireManager();
  if (!clinicId) return { error: "Sem permissão." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Categoria inválida." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome da categoria." };

  const color = normalizeHexColor(String(formData.get("color") ?? ""));
  if (!color) return { error: "Escolha uma cor válida." };

  const icon = normalizeIconName(String(formData.get("icon") ?? ""));

  try {
    await updateSessionTypeCategory(clinicId, id, { name, color, icon });
  } catch (e) {
    const err = e as { code?: string } | null;
    if (err?.code === "23505") return { error: "Já existe uma categoria com esse nome." };
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/settings/categorias-agenda");
  return { ok: true };
}

export async function deleteCategoryAction(id: string) {
  const clinicId = await requireManager();
  if (!clinicId) throw new Error("Sem permissão.");
  await deleteSessionTypeCategory(clinicId, id);
  revalidatePath("/settings/categorias-agenda");
}

export async function reorderCategoriesAction(orderedIds: string[]) {
  const clinicId = await requireManager();
  if (!clinicId) throw new Error("Sem permissão.");
  await reorderSessionTypeCategories(clinicId, orderedIds);
  revalidatePath("/settings/categorias-agenda");
}

// ── Atribuição por tipo de sessão ────────────────────────────────────────────

export async function setSessionTypeCategoryAction(sessionTypeId: string, categoryId: string | null) {
  const clinicId = await requireManager();
  if (!clinicId) throw new Error("Sem permissão.");
  await setSessionTypeCategory(clinicId, sessionTypeId, categoryId);
  revalidatePath("/settings/categorias-agenda");
}

export async function setSessionTypeColorOverrideAction(sessionTypeId: string, hex: string | null) {
  const clinicId = await requireManager();
  if (!clinicId) throw new Error("Sem permissão.");
  const normalized = hex === null ? null : normalizeHexColor(hex);
  // hex informado mas inválido -> não grava lixo; mantém o override atual.
  if (hex !== null && !normalized) throw new Error("Cor inválida.");
  await setSessionTypeColorOverride(clinicId, sessionTypeId, normalized);
  revalidatePath("/settings/categorias-agenda");
}
