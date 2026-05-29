import type { PricingLocation, WhatsAppBotConfigFields } from "@/lib/whatsapp-bot-defaults";

export type { PricingLocation, PricingPlan } from "@/lib/whatsapp-bot-defaults";
export { IFWC_DEFAULT_CONFIG, buildSystemPrompt } from "@/lib/whatsapp-bot-defaults";

export type WhatsAppBotConfig = WhatsAppBotConfigFields & {
  id: string;
  clinic_id: string;
  twilio_number: string | null;
  meta_phone_number_id: string | null;
  clinic_slug: string | null;
};

export async function getWhatsAppBotConfig(clinicId: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*, clinics(slug)")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) return null;
  const clinicSlug = (data.clinics as unknown as { slug: string } | null)?.slug ?? null;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [], clinic_slug: clinicSlug };
}

export async function getWhatsAppBotConfigByNumber(twilioNumber: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*, clinics(slug)")
    .eq("twilio_number", twilioNumber)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const clinicSlug = (data.clinics as unknown as { slug: string } | null)?.slug ?? null;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [], clinic_slug: clinicSlug };
}

// SEC-02: lookup by Meta phone_number_id — used by the Meta webhook to resolve clinic_id.
// Uses admin client because webhooks run without a user session.
// Also fetches clinic slug for booking URL in bot step 7.
export async function getWhatsAppBotConfigByMetaPhoneId(metaPhoneNumberId: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*, clinics(slug)")
    .eq("meta_phone_number_id", metaPhoneNumberId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const clinicSlug = (data.clinics as unknown as { slug: string } | null)?.slug ?? null;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [], clinic_slug: clinicSlug };
}

export async function upsertWhatsAppBotConfig(
  clinicId: string,
  input: Partial<Omit<WhatsAppBotConfig, "id" | "clinic_id">>
): Promise<WhatsAppBotConfig> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  // Use RPC to bypass PGRST schema cache stale issue (meta_phone_number_id column).
  // The stored function runs raw SQL and always knows about the current schema.
  const { data: rpcId, error: rpcError } = await supabase.rpc("upsert_whatsapp_bot_config", {
    p_clinic_id:           clinicId,
    p_professional_name:   input.professional_name ?? "",
    p_clinic_name:         input.clinic_name ?? "",
    p_specialty:           input.specialty ?? "",
    p_methodology:         input.methodology ?? "",
    p_locations:           (input.locations ?? []) as unknown as string,
    p_language:            input.language ?? "pt-BR",
    p_custom_instructions: input.custom_instructions ?? "",
    p_is_active:           input.is_active ?? true,
    p_twilio_number:       input.twilio_number ?? null,
    p_meta_phone_number_id: input.meta_phone_number_id ?? null,
  });
  if (rpcError) throw rpcError;

  // Fetch the full updated row (includes meta_phone_number_id + clinic slug from DB)
  const { data, error } = await supabase
    .from("whatsapp_bot_configs")
    .select("id, clinic_id, professional_name, clinic_name, specialty, methodology, locations, language, custom_instructions, is_active, twilio_number, meta_phone_number_id, created_at, updated_at, clinics(slug)")
    .eq("id", rpcId as string)
    .single();
  if (error) throw error;
  const clinicSlug = (data.clinics as unknown as { slug: string } | null)?.slug ?? null;
  return {
    ...data,
    locations: (data.locations as PricingLocation[]) ?? [],
    clinic_slug: clinicSlug,
  };
}
