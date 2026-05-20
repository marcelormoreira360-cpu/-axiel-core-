"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { saveHotmartToken } from "@/services/hotmart-service";

export async function saveHotmartConfigAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const hottok = (formData.get("hottok") as string | null)?.trim() ?? "";
  if (!hottok) return { error: "O token (hottok) é obrigatório." };

  try {
    await saveHotmartToken(clinic.id, hottok);
    revalidatePath("/settings/integrations/hotmart");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}
