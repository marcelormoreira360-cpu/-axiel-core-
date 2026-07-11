import type { SupabaseClient } from "@supabase/supabase-js";
import type { PricingLocation, WhatsAppBotConfigFields } from "@/lib/whatsapp-bot-defaults";

export type { PricingLocation, PricingPlan } from "@/lib/whatsapp-bot-defaults";
export { IFWC_DEFAULT_CONFIG, buildSystemPrompt, META_LANG_RULE, META_BEHAVIOR_RULE, META_EMERGENCY_RULE, detectMetaLanguage, metaLangToConfigLanguage, funnelStepFromHistory } from "@/lib/whatsapp-bot-defaults";

// Busca o slug da clínica numa consulta separada — evita o join embutido
// `clinics(slug)` do PostgREST, que exige uma FK que não existe porque
// whatsapp_bot_configs.clinic_id é text e clinics.id é uuid (sem relação).
async function fetchClinicSlug(supabase: SupabaseClient, clinicId: string): Promise<string | null> {
  const { data } = await supabase.from("clinics").select("slug").eq("id", clinicId).maybeSingle();
  return ((data as { slug?: string } | null)?.slug) ?? null;
}

export type WhatsAppBotConfig = WhatsAppBotConfigFields & {
  id: string;
  clinic_id: string;
  twilio_number: string | null;
  meta_phone_number_id: string | null;
  meta_instagram_id: string | null;
  meta_facebook_page_id: string | null;
  clinic_slug: string | null;
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
  const clinicSlug = await fetchClinicSlug(supabase, data.clinic_id as string);
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [], clinic_slug: clinicSlug };
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
  const clinicSlug = await fetchClinicSlug(supabase, data.clinic_id as string);
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
    .select("*")
    .eq("meta_phone_number_id", metaPhoneNumberId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const clinicSlug = await fetchClinicSlug(supabase, data.clinic_id as string);
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [], clinic_slug: clinicSlug };
}

// SEC-01 (Instagram): lookup by Meta Instagram account id — used by the Instagram
// webhook to resolve clinic_id from the incoming entry.id. No fallback to a default
// config: if no clinic matches, the webhook drops the message silently.
// Uses admin client because webhooks run without a user session.
export async function getWhatsAppBotConfigByInstagramId(metaInstagramId: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*")
    .eq("meta_instagram_id", metaInstagramId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const clinicSlug = await fetchClinicSlug(supabase, data.clinic_id as string);
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [], clinic_slug: clinicSlug };
}

// Lookup por clinic_id para webhooks que atendem PELA clínica e não por um
// identificador próprio do canal (Messenger e contas extras de Instagram):
// sem isso esses canais rodavam com IFWC_DEFAULT_CONFIG e perdiam as
// custom_instructions (persona Clara) salvas no banco.
// Admin client porque webhooks rodam sem sessão de usuário.
export async function getWhatsAppBotConfigByClinicId(clinicId: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const clinicSlug = await fetchClinicSlug(supabase, data.clinic_id as string);
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [], clinic_slug: clinicSlug };
}

// SEC-01 (Facebook): lookup pela PÁGINA do Facebook (entry.id do webhook). Usado
// pelo webhook do Messenger para resolver a clínica. Sem match, o webhook decide
// o fallback (hoje mantém a IFWC para páginas não registradas, compat single-tenant).
// Usa admin client porque webhooks rodam sem sessão de usuário.
export async function getWhatsAppBotConfigByFacebookPageId(metaFacebookPageId: string): Promise<WhatsAppBotConfig | null> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*")
    .eq("meta_facebook_page_id", metaFacebookPageId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const clinicSlug = await fetchClinicSlug(supabase, data.clinic_id as string);
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
    p_meta_instagram_id:   input.meta_instagram_id ?? null,
  });
  if (rpcError) throw rpcError;

  // meta_facebook_page_id não faz parte da assinatura fixa da função RPC: grava à
  // parte, só quando o campo veio no input (não sobrescreve quando ausente).
  if ("meta_facebook_page_id" in input) {
    const { error: fbError } = await supabase
      .from("whatsapp_bot_configs")
      .update({ meta_facebook_page_id: input.meta_facebook_page_id ?? null })
      .eq("id", rpcId as string);
    if (fbError) throw fbError;
  }

  // Fetch the full updated row (includes meta_phone_number_id + clinic slug from DB)
  const { data, error } = await supabase
    .from("whatsapp_bot_configs")
    .select("id, clinic_id, professional_name, clinic_name, specialty, methodology, locations, language, custom_instructions, is_active, twilio_number, meta_phone_number_id, meta_instagram_id, meta_facebook_page_id, created_at, updated_at")
    .eq("id", rpcId as string)
    .single();
  if (error) throw error;
  const clinicSlug = await fetchClinicSlug(supabase, data.clinic_id as string);
  return {
    ...data,
    locations: (data.locations as PricingLocation[]) ?? [],
    clinic_slug: clinicSlug,
  };
}
