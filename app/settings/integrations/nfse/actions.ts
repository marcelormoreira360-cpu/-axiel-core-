"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { saveNfseConfig } from "@/services/nfse-service";

export async function saveNfseConfigAction(formData: FormData): Promise<{ error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic) return { error: "Clínica não encontrada." };

  const api_key             = (formData.get("api_key") as string ?? "").trim();
  const company_id          = (formData.get("company_id") as string ?? "").trim();
  const city_service_code   = (formData.get("city_service_code") as string ?? "").trim();
  const service_description = (formData.get("service_description") as string ?? "").trim();
  const cnae_code           = (formData.get("cnae_code") as string ?? "").trim() || undefined;

  if (!api_key || !company_id) return { error: "API Key e Company ID são obrigatórios." };

  try {
    await saveNfseConfig(clinic.id, {
      api_key,
      company_id,
      city_service_code:   city_service_code || "1.05",
      service_description: service_description || "Prestação de serviços de saúde",
      cnae_code,
    });
    revalidatePath("/settings/integrations/nfse");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}
