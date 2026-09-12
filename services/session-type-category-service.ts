// ─── Serviço: categorias da agenda (cor/ícone) + atribuição por tipo de sessão ──
//
// CRUD das `session_type_categories` (cor/ícone/ordem) e a atribuição de categoria
// e de `color_override` por `session_types`. Tudo via server client (RLS por
// clínica: select=can_access_clinic; insert/update/delete=can_manage_clinic) e
// escopado por clinic_id — nada hardcoded de clínica, multi-tenant, fail-safe.
//
// Ao excluir uma categoria, a FK session_types.category_id (ON DELETE SET NULL,
// migration 171) zera sozinha os tipos daquela categoria -> voltam ao cinza.

import { createLogger } from "@/lib/logger";
import { getSessionTypeCategories, type SessionTypeCategory } from "@/services/appointment-visual-service";

const log = createLogger("session-type-category-service");

// Reexporta a leitura já existente (fonte única) para as telas de config.
export { getSessionTypeCategories };
export type { SessionTypeCategory };

// ── CRUD de categorias ─────────────────────────────────────────────────────────

/** Cria uma categoria no fim da ordem (sort_order = maior atual + 1). */
export async function createSessionTypeCategory(input: {
  clinic_id: string;
  name: string;
  color: string;
  icon: string | null;
}): Promise<SessionTypeCategory> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const existing = await getSessionTypeCategories(input.clinic_id);
  const nextOrder = existing.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;

  const { data, error } = await supabase
    .from("session_type_categories")
    .insert({
      clinic_id: input.clinic_id,
      name: input.name,
      color: input.color,
      icon: input.icon,
      sort_order: nextOrder,
    })
    .select("id, name, color, icon, sort_order")
    .single();
  if (error) throw error;
  return data as SessionTypeCategory;
}

/** Atualiza nome/cor/ícone de uma categoria (escopada por clínica). */
export async function updateSessionTypeCategory(
  clinicId: string,
  id: string,
  patch: Partial<Pick<SessionTypeCategory, "name" | "color" | "icon">>,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("session_type_categories")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

/** Exclui a categoria; os tipos ligados voltam a category_id null (FK SET NULL). */
export async function deleteSessionTypeCategory(clinicId: string, id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("session_type_categories")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

/** Grava a ordem completa (drag-and-drop): sort_order = posição na lista. */
export async function reorderSessionTypeCategories(
  clinicId: string,
  orderedIds: string[],
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("session_type_categories")
        .update({ sort_order: index, updated_at: now })
        .eq("id", id)
        .eq("clinic_id", clinicId),
    ),
  );
}

// ── Atribuição por tipo de sessão ────────────────────────────────────────────

/** Define (ou limpa, com null) a categoria de um tipo de sessão. */
export async function setSessionTypeCategory(
  clinicId: string,
  sessionTypeId: string,
  categoryId: string | null,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("session_types")
    .update({ category_id: categoryId })
    .eq("id", sessionTypeId)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

/** Define (ou limpa, com null = usar a cor da categoria) o override de cor do tipo. */
export async function setSessionTypeColorOverride(
  clinicId: string,
  sessionTypeId: string,
  hex: string | null,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("session_types")
    .update({ color_override: hex })
    .eq("id", sessionTypeId)
    .eq("clinic_id", clinicId);
  if (error) throw error;
}

/** Tipos de sessão da clínica com os campos que a tela de categorias consome. */
export type SessionTypeForCategory = {
  id: string;
  name: string;
  is_active: boolean;
  category_id: string | null;
  color_override: string | null;
};

export async function getSessionTypesForCategoryScreen(
  clinicId: string,
): Promise<SessionTypeForCategory[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_types")
    .select("id, name, is_active, category_id, color_override")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });
  if (error) {
    log.error("Falha ao carregar tipos de sessão (categorias)", error);
    return [];
  }
  return (data ?? []) as SessionTypeForCategory[];
}
