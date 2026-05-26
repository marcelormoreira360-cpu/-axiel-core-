import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature } from "@/lib/webhook-guard";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG } from "@/services/whatsapp-bot-service";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHistory(
  supabase: SupabaseAdmin,
  psid: string
): Promise<{ id: string | null; messages: ChatMessage[]; botDisabled: boolean }> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled")
      .eq("phone", `fb_${psid}`)
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
  psid: string,
  id: string | null,
  messages: ChatMessage[]
) {
  const payload = {
    phone: `fb_${psid}`,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      await supabase.from("whatsapp_conversations").update(payload).eq("id", id);
    } else {
      await supabase.from("whatsapp_conversations").insert(payload);
    }
  } catch { /* non-blocking */ }
}

// ─── Send reply via Facebook Messenger API ───────────────────────────────────

async function sendFacebookReply(recipientPsid: string, text: string): Promise<void> {
  const token = process.env.META_FACEBOOK_PAGE_TOKEN;
  if (!token) throw new Error("META_FACEBOOK_PAGE_TOKEN not set");

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
    const rawBody = await req.text();

    const signature = req.headers.get("x-hub-signature-256");
    if (!validateMetaSignature(signature, Buffer.from(rawBody))) {
      console.warn("Facebook webhook: invalid signature");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = JSON.parse(rawBody);
    if (body.object !== "page") return new NextResponse("", { status: 200 });

    const supabase = createSupabaseAdminClient();
    const systemPrompt = buildSystemPrompt(IFWC_DEFAULT_CONFIG);

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        // Skip echoes and deliveries
        if (event.message?.is_echo) continue;
        if (!event.message) continue;

        const senderPsid: string = event.sender?.id;
        const messageText: string = event.message?.text?.trim() ?? "";

        if (!senderPsid || !messageText) continue;

        const { id: convId, messages: history, botDisabled } =
          await getHistory(supabase, senderPsid);

        // Human takeover — save message, don't reply
        if (botDisabled) {
          void saveHistory(supabase, senderPsid, convId, [
            ...history,
            { role: "user", content: messageText },
          ]);
          continue;
        }

        const reply = await generateReply(messageText, history, systemPrompt, apiKey);
        const finalReply = reply || "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊";

        void saveHistory(supabase, senderPsid, convId, [
          ...history,
          { role: "user", content: messageText },
          { role: "assistant", content: finalReply },
        ]);

        await sendFacebookReply(senderPsid, finalReply);
      }
    }

    return new NextResponse("", { status: 200 });
  } catch (err) {
    console.error("Facebook Messenger webhook error:", err);
    return new NextResponse("", { status: 200 });
  }
}
