import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type WaMessage = { role: "user" | "assistant"; content: string };

export type WaConversation = {
  id: string;
  phone: string;
  clinic_id: string | null;
  messages: WaMessage[];
  created_at: string;
  updated_at: string;
  bot_disabled: boolean;
  handled_by_human: boolean;
  handled_by_name: string | null;
  linked_patient_id: string | null;
  linked_lead_id: string | null;
  ai_paused: boolean;
  last_human_message_at: string | null;
};

export type WaStats = {
  total: number;
  newToday: number;
  messagesToday: number;
  botActive: boolean;
};

// ── List conversations for a clinic ────────────────────────────────────────

export async function listConversations(clinicId?: string): Promise<WaConversation[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("whatsapp_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(coerce);
}

// ── Get single conversation by phone ───────────────────────────────────────

export async function getConversationByPhone(phone: string): Promise<WaConversation | null> {
  const supabase = createSupabaseAdminClient();
  const normalized = phone.replace(/\s+/g, "").replace(/^00/, "+");
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("phone", normalized)
    .maybeSingle();
  return data ? coerce(data) : null;
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getWaStats(clinicId?: string): Promise<WaStats> {
  const supabase = createSupabaseAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const baseConv = supabase.from("whatsapp_conversations").select("id, created_at, messages, clinic_id");
  const { data: convs } = clinicId
    ? await baseConv.eq("clinic_id", clinicId)
    : await baseConv;

  const all = convs ?? [];
  const newToday = all.filter(
    (c) => new Date(c.created_at) >= todayStart,
  ).length;

  // Count messages from today
  let messagesToday = 0;
  for (const c of all) {
    // We don't have per-message timestamps, so count interactions from today via interactions table
    messagesToday += (c.messages as WaMessage[]).length;
  }

  // Check bot config active status
  let botActive = false;
  if (clinicId) {
    const { data: cfg } = await supabase
      .from("whatsapp_bot_configs")
      .select("is_active")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    botActive = cfg?.is_active ?? false;
  } else {
    // Check env vars — bot is active if Twilio is configured
    botActive = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );
  }

  return { total: all.length, newToday, messagesToday, botActive };
}

// ── Passagem de bastão (pausar / devolver a IA) ────────────────────────────

/**
 * Pausa a IA na conversa ("Pausar IA"). Também grava o legado bot_disabled
 * por segurança: qualquer código antigo que só conheça bot_disabled continua
 * respeitando a pausa.
 */
export async function pauseAi(
  conversationId: string,
  handledByName?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("whatsapp_conversations")
    .update({
      ai_paused: true,
      bot_disabled: true,
      handled_by_human: true,
      handled_by_name: handledByName ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

/**
 * Devolve a conversa para a Clara ("Devolver para a Clara"): limpa a pausa
 * manual E a janela de 24h de atendimento humano.
 */
export async function resumeAi(conversationId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("whatsapp_conversations")
    .update({
      ai_paused: false,
      bot_disabled: false,
      handled_by_human: false,
      handled_by_name: null,
      last_human_message_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

// ── Link patient or lead ───────────────────────────────────────────────────

export async function linkEntityToConversation(
  conversationId: string,
  opts: { patientId?: string | null; leadId?: string | null },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const updates: Record<string, string | null> = {};
  if ("patientId" in opts) updates.linked_patient_id = opts.patientId ?? null;
  if ("leadId" in opts) updates.linked_lead_id = opts.leadId ?? null;
  if (Object.keys(updates).length === 0) return;
  await supabase
    .from("whatsapp_conversations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

// ── Helpers ────────────────────────────────────────────────────────────────

type WaConversationRow = {
  id: string;
  phone: string;
  clinic_id: string | null;
  messages: WaMessage[] | null;
  created_at: string;
  updated_at: string;
  bot_disabled: boolean | null;
  handled_by_human: boolean | null;
  handled_by_name: string | null;
  linked_patient_id: string | null;
  linked_lead_id: string | null;
  ai_paused: boolean | null;
  last_human_message_at: string | null;
};

function coerce(row: WaConversationRow): WaConversation {
  return {
    id: row.id,
    phone: row.phone,
    clinic_id: row.clinic_id ?? null,
    messages: row.messages ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    bot_disabled: row.bot_disabled ?? false,
    handled_by_human: row.handled_by_human ?? false,
    handled_by_name: row.handled_by_name ?? null,
    linked_patient_id: row.linked_patient_id ?? null,
    linked_lead_id: row.linked_lead_id ?? null,
    ai_paused: row.ai_paused ?? false,
    last_human_message_at: row.last_human_message_at ?? null,
  };
}

// ── Last message helper ────────────────────────────────────────────────────

export function getLastMessage(conv: WaConversation): WaMessage | null {
  return conv.messages[conv.messages.length - 1] ?? null;
}

export function formatPhone(phone: string): string {
  // Conversas de SMS ficam com o prefixo "sms_" no campo phone (evita colisão
  // com o WhatsApp do mesmo número); exibe o telefone real.
  if (phone.startsWith("sms_")) phone = phone.slice(4);
  const d = phone.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    // Brazilian: 55 + DDD(2) + 9digit
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 5)} ${d.slice(5, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return phone;
}
