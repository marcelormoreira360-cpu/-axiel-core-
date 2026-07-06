// Motor conversacional compartilhado dos webhooks Twilio (WhatsApp e SMS).
//
// Extraído de app/api/whatsapp/webhook/route.ts para o canal de SMS reutilizar
// a MESMA mecânica (histórico em whatsapp_conversations, lead automático,
// resposta via OpenAI e gate de plano) sem duplicar código. A chave da conversa
// (conversationKey) é o campo `phone`: número puro no WhatsApp Twilio,
// `sms_+1...` no SMS (prefixo evita colisão do mesmo número nos dois canais).

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canUseFeature } from "@/modules/billing/feature-access";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export type ConversationState = {
  id: string | null;
  messages: ChatMessage[];
  botDisabled: boolean;
  aiPaused: boolean;
  lastHumanMessageAt: string | null;
  clinicId: string | null;
  updatedAt: string | null;
};

// ─── Histórico da conversa ───────────────────────────────────────────────────

export async function getConversationState(
  supabase: SupabaseAdmin,
  conversationKey: string,
): Promise<ConversationState> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled, ai_paused, last_human_message_at, clinic_id, updated_at")
      .eq("phone", conversationKey)
      .maybeSingle();
    return {
      id: data?.id ?? null,
      messages: (data?.messages as ChatMessage[]) ?? [],
      botDisabled: data?.bot_disabled ?? false,
      aiPaused: data?.ai_paused ?? false,
      lastHumanMessageAt: data?.last_human_message_at ?? null,
      clinicId: data?.clinic_id ?? null,
      updatedAt: data?.updated_at ?? null,
    };
  } catch {
    return { id: null, messages: [], botDisabled: false, aiPaused: false, lastHumanMessageAt: null, clinicId: null, updatedAt: null };
  }
}

export async function saveConversation(
  supabase: SupabaseAdmin,
  conversationKey: string,
  id: string | null,
  messages: ChatMessage[],
  clinicId?: string | null,
  logTag = "twilio",
) {
  const payload: Record<string, unknown> = {
    phone: conversationKey,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      const { error } = await supabase.from("whatsapp_conversations").update(payload).eq("id", id);
      if (error) console.error(`[${logTag}] saveConversation UPDATE error:`, error.message);
    } else {
      // BUG-01: upsert prevents duplicate rows when two rapid messages arrive simultaneously
      if (clinicId) payload.clinic_id = clinicId;
      const { error } = await supabase.from("whatsapp_conversations").upsert(payload, { onConflict: "phone" });
      if (error) console.error(`[${logTag}] saveConversation UPSERT error:`, error.message);
    }
  } catch (e) {
    console.error(`[${logTag}] saveConversation exception:`, e);
  }
}

// ─── Lead automático para número desconhecido ────────────────────────────────
// O lead é criado com o TELEFONE REAL (sem prefixo de canal) para o dedup com
// pacientes/leads existentes funcionar entre canais.

export async function autoCreateLeadFromChannel(
  supabase: SupabaseAdmin,
  opts: { phone: string; clinicId: string; firstMessage: string; channelLabel: string },
) {
  const { phone, clinicId, firstMessage, channelLabel } = opts;
  try {
    // Check if already a patient or lead with this phone
    const [{ count: patientCount }, { count: leadCount }] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("phone", phone),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("phone", phone),
    ]);
    if ((patientCount ?? 0) > 0 || (leadCount ?? 0) > 0) return; // already known

    await supabase.from("leads").insert({
      clinic_id: clinicId,
      full_name: `${channelLabel} ${phone.slice(-4)}`,
      phone,
      source: "other",
      stage: "new_lead",
      notes: `Lead criado automaticamente via ${channelLabel}.\nPrimeira mensagem: "${firstMessage.slice(0, 200)}"`,
    });
  } catch (e) {
    console.error("auto-create lead failed:", e);
  }
}

// ─── Resposta via OpenAI ─────────────────────────────────────────────────────

export async function generateReply(
  incomingMessage: string,
  history: ChatMessage[],
  systemPrompt: string,
  apiKey: string,
  opts?: { maxTokens?: number },
): Promise<string> {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-12),
    { role: "user" as const, content: incomingMessage },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000), // INT-04: prevent webhook timeout on slow OpenAI responses
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: opts?.maxTokens ?? 450,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("OpenAI error:", res.status, JSON.stringify(data));
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Gate de plano (whatsapp_automation) ─────────────────────────────────────
// Mesma regra do webhook de WhatsApp Twilio: sem assinatura ou erro de leitura,
// cai para "starter" (sem acesso), evitando uso do bot fora do plano.

export async function clinicHasWhatsAppAutomation(
  supabase: SupabaseAdmin,
  clinicId: string,
): Promise<boolean> {
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("plans(code, slug)")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const plans = subRow?.plans as { code?: string | null; slug?: string | null } | null;
  const planSlug = plans?.code ?? plans?.slug ?? "starter";
  return canUseFeature({ planSlug }, "whatsapp_automation");
}
