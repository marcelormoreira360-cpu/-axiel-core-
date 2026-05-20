"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic, updateClinic } from "@/services/clinic-service";

export async function saveBrandingAction(formData: FormData): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const logo_url = (formData.get("logo_url") as string | null)?.trim() || null;
  const primary_color = (formData.get("primary_color") as string | null)?.trim() || null;

  try {
    await updateClinic(clinic.id, { logo_url, primary_color });
    revalidatePath("/settings/branding");
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}
