import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature } from "@/lib/webhook-guard";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG, META_LANG_RULE, funnelStepFromHistory } from "@/services/whatsapp-bot-service";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

// Clínica atendida por este webhook (IFWC). Configurável por env; fallback fixo.
const IFWC_CLINIC_ID =
  process.env.META_BOT_CLINIC_ID ?? "98e98ef3-a056-40bd-989b-0ab69d0c4bff";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHistory(
  supabase: SupabaseAdmin,
  psid: string
): Promise<{ id: string | null; messages: ChatMessage[]; botDisabled: boolean; clinicId: string | null }> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled, clinic_id")
      .eq("phone", `fb_${psid}`)
      .maybeSingle();
    return {
      id: data?.id ?? null,
      messages: (data?.messages as ChatMessage[]) ?? [],
      botDisabled: data?.bot_disabled ?? false,
      clinicId: data?.clinic_id ?? null,
    };
  } catch {
    return { id: null, messages: [], botDisabled: false, clinicId: null };
  }
}

async function saveHistory(
  supabase: SupabaseAdmin,
  psid: string,
  id: string | null,
  messages: ChatMessage[],
  clinicId?: string | null
) {
  const payload: Record<string, unknown> = {
    phone: `fb_${psid}`,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      const { error } = await supabase.from("whatsapp_conversations").update(payload).eq("id", id);
      if (error) console.error("[messenger] saveHistory UPDATE error:", error.message);
    } else {
      // clinic_id é NOT NULL na tabela — sem ele o insert falha silenciosamente
      if (clinicId) payload.clinic_id = clinicId;
      const { error } = await supabase
        .from("whatsapp_conversations")
        .upsert(payload, { onConflict: "phone" });
      if (error) console.error("[messenger] saveHistory UPSERT error:", error.message);
    }
  } catch (e) {
    console.error("[messenger] saveHistory exception:", e);
  }
}

// Cria lead no CRM quando um PSID desconhecido inicia conversa (não bloqueia o bot)
async function autoCreateLead(
  supabase: SupabaseAdmin,
  psid: string,
  clinicId: string,
  firstMessage: string
) {
  try {
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("phone", `fb_${psid}`);
    if ((count ?? 0) > 0) return; // já existe

    await supabase.from("leads").insert({
      clinic_id: clinicId,
      full_name: `Messenger ${psid.slice(-4)}`,
      phone: `fb_${psid}`,
      source: "other",
      stage: "new_lead",
      notes: `Lead criado automaticamente via Facebook Messenger.\nPrimeira mensagem: "${firstMessage.slice(0, 200)}"`,
    });
  } catch (e) {
    console.error("[messenger] auto-create lead failed:", e);
  }
}

// ─── Page token lookup ────────────────────────────────────────────────────────
// Env var per page: META_FACEBOOK_TOKEN_<PAGE_ID>
// Falls back to META_FACEBOOK_PAGE_TOKEN for any unlisted page.

function getPageToken(pageId: string): string {
  const specific = process.env[`META_FACEBOOK_TOKEN_${pageId}`];
  const fallback = process.env.META_FACEBOOK_PAGE_TOKEN;
  const token = specific ?? fallback;
  if (!token) throw new Error(`No Facebook token for page ${pageId}`);
  return token;
}

// ─── Send reply via Facebook Messenger API ───────────────────────────────────

async function sendFacebookReply(recipientPsid: string, text: string, pageId: string): Promise<void> {
  const token = getPageToken(pageId);

  const res = await fetch("https://graph.facebook.com/v20.0/me/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Facebook Messenger send error:", JSON.stringify(err));
    throw new Error(`Facebook API error: ${res.status}`);
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
    console.error("OpenAI error (Facebook):", res.status, JSON.stringify(data));
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Opt-out / human escalation (exigência do App Review) ────────────────────
// O paciente pode pedir para falar com uma pessoa. Frase-based (sem "parar"
// sozinho) para evitar falso positivo em conversa clínica ("parar de sentir dor").
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
    console.log("Facebook Messenger webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — incoming Facebook Messenger messages ─────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new NextResponse("", { status: 200 });

  try {
    // Bytes brutos para validar a assinatura (re-codificar o texto quebra o HMAC
    // quando a mensagem tem acento/emoji, ex.: "Olá").
    const rawBuffer = Buffer.from(await req.arrayBuffer());

    const signature = req.headers.get("x-hub-signature-256");
    if (!validateMetaSignature(signature, rawBuffer)) {
      console.warn("Facebook webhook: invalid signature");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = JSON.parse(rawBuffer.toString("utf-8"));
    if (body.object !== "page") return new NextResponse("", { status: 200 });

    const supabase = createSupabaseAdminClient();

    for (const entry of body.entry ?? []) {
      const pageId: string = entry.id;

      for (const event of entry.messaging ?? []) {
        // Skip echoes and deliveries
        if (event.message?.is_echo) continue;
        if (!event.message) continue;

        const senderPsid: string = event.sender?.id;
        const messageText: string = event.message?.text?.trim() ?? "";

        if (!senderPsid || !messageText) continue;

        const { id: convId, messages: history, botDisabled, clinicId: convClinicId } =
          await getHistory(supabase, senderPsid);
        const effectiveClinicId = convClinicId ?? IFWC_CLINIC_ID;

        // Human takeover — save message, don't reply
        if (botDisabled) {
          await saveHistory(supabase, senderPsid, convId, [
            ...history,
            { role: "user", content: messageText },
          ], effectiveClinicId);
          continue;
        }

        // Opt-out / escalonamento humano: responde uma vez, marca a conversa
        // para um humano assumir (bot_disabled) e para de auto-responder.
        if (isOptOutRequest(messageText)) {
          const handover =
            "Claro! Vou avisar a equipe e em breve uma pessoa entra em contato com você por aqui. 🙏 " +
            "(Of course! I'll let the team know and a person will reach out to you here shortly.)";
          await saveHistory(supabase, senderPsid, convId, [
            ...history,
            { role: "user", content: messageText },
            { role: "assistant", content: handover },
          ], effectiveClinicId);
          await supabase
            .from("whatsapp_conversations")
            .update({ bot_disabled: true })
            .eq("phone", `fb_${senderPsid}`)
            .then(() => {}, () => {});
          await sendFacebookReply(senderPsid, handover, pageId);
          continue;
        }

        // Primeira mensagem de um PSID novo → cria lead no CRM
        if (!convId) {
          void autoCreateLead(supabase, senderPsid, effectiveClinicId, messageText);
        }

        // Passo do funil estimado pelo histórico (sai do "preso no passo 1")
        const step = funnelStepFromHistory(history.length);
        const systemPrompt = buildSystemPrompt(IFWC_DEFAULT_CONFIG, step) + META_LANG_RULE;

        const reply = await generateReply(messageText, history, systemPrompt, apiKey);
        const finalReply = reply || "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊";

        await saveHistory(supabase, senderPsid, convId, [
          ...history,
          { role: "user", content: messageText },
          { role: "assistant", content: finalReply },
        ], effectiveClinicId);

        await sendFacebookReply(senderPsid, finalReply, pageId);
      }
    }

    return new NextResponse("", { status: 200 });
  } catch (err) {
    console.error("Facebook Messenger webhook error:", err);
    return new NextResponse("", { status: 200 });
  }
}
