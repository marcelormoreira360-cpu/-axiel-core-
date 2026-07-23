import type { SessionType } from "@/lib/types";

export async function getSessionTypesForClinic(clinicId: string): Promise<SessionType[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_types")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createSessionType(input: {
  clinic_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  is_online: boolean;
}): Promise<SessionType> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_types")
    .insert({ ...input, is_active: true })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSessionType(
  id: string,
  fields: Partial<Pick<SessionType, "name" | "duration_minutes" | "price_cents" | "is_active" | "is_online" | "is_recorded">>,
): Promise<SessionType> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_types")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSessionType(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("session_types").delete().eq("id", id);
  if (error) throw error;
}

// ── Traduções do nome do serviço (session_type_translations) ─────────────────
// O nome base (session_types.name) é o idioma padrão da clínica e o fallback.
// A clínica cadastra as versões en / pt-PT; o paciente vê o nome no idioma dele.

/** Nome localizado com fallback: tradução do locale pedido -> nome base. */
export function pickSessionTypeName(
  base: string,
  translations: Record<string, string> | undefined,
  locale: string,
): string {
  return translations?.[locale]?.trim() || base;
}

/** Traduções de TODOS os serviços da clínica: { session_type_id: { locale: name } }. */
export async function getSessionTypeTranslations(
  clinicId: string,
): Promise<Record<string, Record<string, string>>> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_type_translations")
    .select("session_type_id, locale, name")
    .eq("clinic_id", clinicId);
  if (error) throw error;

  const map: Record<string, Record<string, string>> = {};
  for (const row of data ?? []) {
    (map[row.session_type_id] ??= {})[row.locale] = row.name;
  }
  return map;
}

/** Upsert (ou remoção, se vazio) da tradução de um serviço num idioma. */
export async function setSessionTypeTranslation(
  sessionTypeId: string,
  clinicId: string,
  locale: string,
  name: string,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const trimmed = name.trim();

  if (!trimmed) {
    const { error } = await supabase
      .from("session_type_translations")
      .delete()
      .eq("session_type_id", sessionTypeId)
      .eq("locale", locale);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("session_type_translations")
    .upsert(
      { session_type_id: sessionTypeId, clinic_id: clinicId, locale, name: trimmed },
      { onConflict: "session_type_id,locale" },
    );
  if (error) throw error;
}
