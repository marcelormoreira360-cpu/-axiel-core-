"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentUserProfile } from "@/services/user-service";

export type CatalogState = { ok?: boolean; error?: string } | null;

// Salva o catálogo de testes clínicos da clínica em clinic_settings.settings.clinical_test_catalog.
export async function saveClinicalTestCatalogAction(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { error: "Não autorizado." };
  if (!["clinic_owner", "clinic_manager", "admin"].includes(profile.role ?? "")) {
    return { error: "Sem permissão." };
  }

  let names: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("catalog") ?? "[]"));
    if (Array.isArray(parsed)) {
      const seen = new Set<string>();
      names = parsed
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => {
          if (!x || seen.has(x.toLowerCase())) return false;
          seen.add(x.toLowerCase());
          return true;
        })
        .slice(0, 100);
    }
  } catch {
    return { error: "Dados inválidos." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: cs } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  const current = (cs?.settings as Record<string, unknown> | null) ?? {};
  const updated = { ...current, clinical_test_catalog: names };

  const { error } = await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: profile.clinic_id, settings: updated }, { onConflict: "clinic_id" });

  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/settings/clinical-tests");
  return { ok: true };
}
