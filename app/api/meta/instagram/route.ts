import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature } from "@/lib/webhook-guard";
import { buildSystemPrompt, getWhatsAppBotConfigByInstagramId, META_LANG_RULE, funnelStepFromHistory } from "@/services/whatsapp-bot-service";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHistory(
  supabase: SupabaseAdmin,
  userId: string
): Promise<{ id: string | null; messages: ChatMessage[]; botDisabled: boolean }> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled")
      .eq("phone", `ig_${userId}`)
      .maybeSingle();
    return {
      id: data?.id ?? null,
      messages: (data?.messages as ChatMessage[]) ?? [],
      botDisabled: data?.bot_disabled ?? false,
    };
  } catch {
    return { id: null, messages: [], botDisabled: false };
  }
}

async function saveHistory(
  supabase: SupabaseAdmin,
  userId: string,
  id: string | null,
  messages: ChatMessage[],
  clinicId?: string | null
) {
  const payload: Record<string, unknown> = {
    phone: `ig_${userId}`,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      await supabase.from("whatsapp_conversations").update(payload).eq("id", id);
    } else {
      // New row — clinic_id is required (NOT NULL). UPSERT on phone is safe
      // against concurrent first messages from the same IG user.
      if (clinicId) payload.clinic_id = clinicId;
      await supabase.from("whatsapp_conversations").upsert(payload, { onConflict: "phone" });
    }
  } catch { /* non-blocking */ }
}

// Cria lead no CRM quando um usuário novo do Instagram inicia conversa (não bloqueia o bot)
async function autoCreateLead(
  supabase: SupabaseAdmin,
  userId: string,
  clinicId: string,
  firstMessage: string
) {
  try {
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("phone", `ig_${userId}`);
    if ((count ?? 0) > 0) return; // já existe

    await supabase.from("leads").insert({
      clinic_id: clinicId,
      full_name: `Instagram ${userId.slice(-4)}`,
      phone: `ig_${userId}`,
      source: "other",
      stage: "new_lead",
      notes: `Lead criado automaticamente via Instagram DM.\nPrimeira mensagem: "${firstMessage.slice(0, 200)}"`,
    });
  } catch (e) {
    console.error("[instagram] auto-create lead failed:", e);
  }
}

// ─── Send reply via Instagram Graph API ──────────────────────────────────────

async function sendInstagramReply(recipientId: string, text: string): Promise<void> {
  const token = process.env.META_INSTAGRAM_TOKEN;
  if (!token) throw new Error("META_INSTAGRAM_TOKEN not set");

  const res = await fetch("https://graph.facebook.com/v20.0/me/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Instagram send error:", JSON.stringify(err));
    throw new Error(`Instagram API error: ${res.status}`);
  }
}

// ─── AI reply ────────────────────────────────────────────────────────────────

async function generateReply(
  message: string,
  history: ChatMessage[],
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-12),
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 450,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("OpenAI error (Instagram):", res.status, JSON.stringify(data));
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Opt-out / human escalation detection ────────────────────────────────────
// Meta App Review requires that users can easily opt out of automation and reach
// a person. We detect clear "talk to a human" intents (PT/EN). Kept phrase-based
// (and avoiding bare "stop/parar") to prevent false positives in a clinical chat
// (e.g. "quero parar de sentir dor").
const OPT_OUT_PATTERNS = [
  "falar com atendente", "falar com um atendente", "falar com humano", "falar com um humano",
  "falar com uma pessoa", "falar com alguem", "falar com a equipe", "falar com a recepcao",
  "atendente", "atendimento humano", "quero um humano", "pessoa de verdade", "ser humano",
  "talk to a human", "talk to a person", "talk to an agent", "speak to a human",
  "speak to a person", "speak to an agent", "speak to someone", "real person",
  "human agent", "live agent",
];

function isOptOutRequest(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return OPT_OUT_PATTERNS.some((p) => t.includes(p));
}

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("Instagram webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — incoming Instagram DMs ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new NextResponse("", { status: 200 });

  try {
    const rawBody = await req.text();

    const signature = req.headers.get("x-hub-signature-256");
    if (!validateMetaSignature(signature, Buffer.from(rawBody))) {
      console.warn("Instagram webhook: invalid signature");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = JSON.parse(rawBody);
    if (body.object !== "instagram") return new NextResponse("", { status: 200 });

    const supabase = createSupabaseAdminClient();

    for (const entry of body.entry ?? []) {
      // SEC-01: resolve the clinic from the Instagram account id (entry.id).
      // No fallback to a hardcoded config — if no clinic has this IG id
      // configured, skip the entry silently (never leak another clinic's data).
      const igAccountId: string = entry.id ?? "";
      if (!igAccountId) continue;

      const botConfig = await getWhatsAppBotConfigByInstagramId(igAccountId).catch(() => null);
      if (!botConfig) continue;

      const clinicId = botConfig.clinic_id;

      for (const event of entry.messaging ?? []) {
        // Skip echoes (messages sent by the page itself)
        if (event.message?.is_echo) continue;

        const senderId: string = event.sender?.id;
        const messageText: string = event.message?.text?.trim() ?? "";

        if (!senderId || !messageText) continue;

        const { id: convId, messages: history, botDisabled } =
          await getHistory(supabase, senderId);

        // Human takeover — save message, don't reply
        if (botDisabled) {
          await saveHistory(supabase, senderId, convId, [
            ...history,
            { role: "user", content: messageText },
          ], clinicId);
          continue;
        }

        // Opt-out / human escalation (Meta App Review requirement): the patient
        // can ask to talk to a person. We reply once, flag the conversation for a
        // human to take over (bot_disabled), and stop auto-replying in this thread.
        if (isOptOutRequest(messageText)) {
          const handover = botConfig.language === "en-US"
            ? "Of course! I'll let the team know and a person will reach out to you here shortly. 🙏"
            : "Claro! Vou avisar a equipe e em breve uma pessoa entra em contato com você por aqui. 🙏";
          await saveHistory(supabase, senderId, convId, [
            ...history,
            { role: "user", content: messageText },
            { role: "assistant", content: handover },
          ], clinicId);
          await supabase
            .from("whatsapp_conversations")
            .update({ bot_disabled: true })
            .eq("phone", `ig_${senderId}`)
            .then(() => {}, () => {});
          await sendInstagramReply(senderId, handover);
          continue;
        }

        // Primeira mensagem de um usuário novo → cria lead no CRM
        if (!convId) {
          void autoCreateLead(supabase, senderId, clinicId, messageText);
        }

        // Passo do funil estimado pelo histórico + regra de idioma (PT/EN)
        const step = funnelStepFromHistory(history.length);
        const systemPrompt = buildSystemPrompt(botConfig, step) + META_LANG_RULE;

        const reply = await generateReply(messageText, history, systemPrompt, apiKey);
        const finalReply = reply || "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊";

        await saveHistory(supabase, senderId, convId, [
          ...history,
          { role: "user", content: messageText },
          { role: "assistant", content: finalReply },
        ], clinicId);

        await sendInstagramReply(senderId, finalReply);
      }
    }

    return new NextResponse("", { status: 200 });
  } catch (err) {
    console.error("Instagram webhook error:", err);
    return new NextResponse("", { status: 200 });
  }
}
