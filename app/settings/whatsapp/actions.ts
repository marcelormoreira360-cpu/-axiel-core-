"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/services/clinic-service";
import { upsertWhatsAppBotConfig, type PricingLocation } from "@/services/whatsapp-bot-service";

export async function saveWhatsAppBotConfig(formData: FormData) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("Clínica não encontrada.");

  // SEC-02: validate field lengths before upsert to prevent oversized payloads
  const professionalName = (formData.get("professional_name") as string)?.trim() || "";
  const clinicName = (formData.get("clinic_name") as string)?.trim() || "";
  const specialty = (formData.get("specialty") as string)?.trim() || "";
  const methodology = (formData.get("methodology") as string)?.trim() || "";
  const customInstructions = (formData.get("custom_instructions") as string)?.trim() || "";

  if (professionalName.length > 120) throw new Error("Nome profissional muito longo (máx. 120 caracteres).");
  if (clinicName.length > 120) throw new Error("Nome da clínica muito longo (máx. 120 caracteres).");
  if (specialty.length > 300) throw new Error("Especialidade muito longa (máx. 300 caracteres).");
  if (methodology.length > 5000) throw new Error("Metodologia muito longa (máx. 5000 caracteres).");
  if (customInstructions.length > 3000) throw new Error("Instruções adicionais muito longas (máx. 3000 caracteres).");

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
    professional_name: professionalName,
    clinic_name: clinicName,
    specialty,
    methodology,
    language: (formData.get("language") as string) || "pt-BR",
    custom_instructions: customInstructions,
    locations,
    is_active: true,
  });

  revalidatePath("/settings/whatsapp");
}
