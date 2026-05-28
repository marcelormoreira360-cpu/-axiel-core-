import type { PricingLocation, WhatsAppBotConfigFields } from "@/lib/whatsapp-bot-defaults";

export type { PricingLocation, PricingPlan } from "@/lib/whatsapp-bot-defaults";
export { IFWC_DEFAULT_CONFIG, buildSystemPrompt } from "@/lib/whatsapp-bot-defaults";

export type WhatsAppBotConfig = WhatsAppBotConfigFields & {
  id: string;
  clinic_id: string;
  twilio_number: string | null;
  meta_phone_number_id: string | null;
};

export async function getWhatsAppBotConfig(clinicId: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [] };
}

export async function getWhatsAppBotConfigByNumber(twilioNumber: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*")
    .eq("twilio_number", twilioNumber)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [] };
}

// SEC-02: lookup by Meta phone_number_id — used by the Meta webhook to resolve clinic_id.
// Uses admin client because webhooks run without a user session.
export async function getWhatsAppBotConfigByMetaPhoneId(metaPhoneNumberId: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*")
    .eq("meta_phone_number_id", metaPhoneNumberId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [] };
}

export async function upsertWhatsAppBotConfig(
  clinicId: string,
  input: Partial<Omit<WhatsAppBotConfig, "id" | "clinic_id">>
): Promise<WhatsAppBotConfig> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("whatsapp_bot_configs")
    .upsert({ clinic_id: clinicId, ...input, updated_at: new Date().toISOString() }, { onConflict: "clinic_id" })
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [] };
}
