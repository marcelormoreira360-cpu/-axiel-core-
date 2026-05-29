"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { saveClinicZoomCredentials, removeClinicZoomCredentials } from "@/services/zoom-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function saveZoomCredentialsAction(formData: FormData): Promise<{ ok: boolean; error: string | null }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ok: false, error: "Não autorizado." };
  if (!["clinic_owner", "clinic_manager"].includes(profile.role ?? "")) {
    return { ok: false, error: "Sem permissão." };
  }

  const account_id    = String(formData.get("zoom_account_id")    ?? "").trim();
  const client_id     = String(formData.get("zoom_client_id")     ?? "").trim();
  const client_secret = String(formData.get("zoom_client_secret") ?? "").trim();

  if (!account_id || !client_id || !client_secret) {
    return { ok: false, error: "Preencha todos os campos." };
  }

  try {
    await saveClinicZoomCredentials(profile.clinic_id, { account_id, client_id, client_secret });
    revalidatePath("/settings/integrations");
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Erro ao salvar credenciais." };
  }
}

export async function removeZoomCredentialsAction(): Promise<{ ok: boolean; error: string | null }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ok: false, error: "Não autorizado." };

  try {
    await removeClinicZoomCredentials(profile.clinic_id);
    revalidatePath("/settings/integrations");
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Erro ao remover credenciais." };
  }
}

// ── Google Reviews URL ────────────────────────────────────────────────────────

export async function saveGoogleReviewUrlAction(formData: FormData): Promise<{ ok: boolean; error: string | null }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return { ok: false, error: "Não autorizado." };
  if (!["clinic_owner", "clinic_manager"].includes(profile.role ?? "")) {
    return { ok: false, error: "Sem permissão." };
  }

  const url = String(formData.get("google_review_url") ?? "").trim();

  // Basic validation: must be a Google Maps or Google Business review URL (or empty to clear)
  if (url && !url.startsWith("https://")) {
    return { ok: false, error: "URL inválida. Deve começar com https://" };
  }

  const supabase = createSupabaseAdminClient();

  // Read current settings JSONB
  const { data: cs } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  const current = (cs?.settings as Record<string, unknown> | null) ?? {};
  const updated = { ...current, google_review_url: url || null };

  await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: profile.clinic_id, settings: updated }, { onConflict: "clinic_id" });

  revalidatePath("/settings/integrations");
  return { ok: true, error: null };
}
