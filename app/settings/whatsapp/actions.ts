"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { upsertWhatsAppBotConfig, type PricingLocation } from "@/services/whatsapp-bot-service";

export async function saveWhatsAppBotConfig(formData: FormData) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("Clínica não encontrada.");

  const locationsRaw = formData.get("locations_json") as string;
  let locations: PricingLocation[] = [];
  try {
    locations = JSON.parse(locationsRaw || "[]");
  } catch {
    locations = [];
  }

  await upsertWhatsAppBotConfig(clinic.id, {
    twilio_number: (formData.get("twilio_number") as string)?.trim() || null,
    meta_phone_number_id: (formData.get("meta_phone_number_id") as string)?.trim() || null,
    professional_name: (formData.get("professional_name") as string)?.trim() || "",
    clinic_name: (formData.get("clinic_name") as string)?.trim() || "",
    specialty: (formData.get("specialty") as string)?.trim() || "",
    methodology: (formData.get("methodology") as string)?.trim() || "",
    language: (formData.get("language") as string) || "pt-BR",
    custom_instructions: (formData.get("custom_instructions") as string)?.trim() || "",
    locations,
    is_active: true,
  });

  revalidatePath("/settings/whatsapp");
}
