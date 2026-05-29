"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import { saveClinicZoomCredentials, removeClinicZoomCredentials } from "@/services/zoom-service";

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
