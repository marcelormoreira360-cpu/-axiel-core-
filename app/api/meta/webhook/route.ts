import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature, checkRateLimit } from "@/lib/webhook-guard";

export const runtime = "nodejs";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

type MetaPlatform = "messenger" | "instagram";

// ─── Conversation History ─────────────────────────────────────────────────────

async function getHistory(
  supabase: any,
  senderId: string,
  platform: MetaPlatform
): Promise<{ id: string | null; messages: ChatMessage[] }> {
  try {
    const { data } = await supabase
      .from("meta_conversations")
      .select("id, messages")
      .eq("sender_id", senderId)
      .eq("platform", platform)
      .maybeSingle();
    return { id: data?.id ?? null, messages: (data?.messages as ChatMessage[]) ?? [] };
  } catch {
    return { id: null, messages: [] };
  }
}

async function saveHistory(
  supabase: any,
  senderId: string,
  platform: MetaPlatform,
  id: string | null,
  messages: ChatMessage[]
) {
  const payload = {
    sender_id: senderId,
    platform,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      await supabase.from("meta_conversations").update(payload).eq("id", id);
    } else {
      await supabase.from("meta_conversations").insert(payload);
    }
  } catch {
    // non-blocking
  }
}

// ─── AI Reply ─────────────────────────────────────────────────────────────────

async function generateReply(
  incomingMessage: string,
  history: ChatMessage[],
  platform: MetaPlatform,
  apiKey: string
): Promise<string> {
  const systemPrompt = `You are a helpful AI assistant for Marcelo Moreira | Neuro ID Method, an integrative wellness practitioner.
You respond to ${platform === "instagram" ? "Instagram DMs" : "Facebook Messenger"} messages in a warm, professional, and helpful manner.
You help answer questions about services, scheduling, and general wellness inquiries.
Always respond in the same language the user writes in.
Keep responses concise and friendly. If someone wants to book a consultation, direct them to: https://axiel-core-6ikl.vercel.app/book/ifwc`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-12),
    { role: "user" as const, content: incomingMessage },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 400,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("OpenAI error:", res.status, JSON.stringify(data));
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Send Message via Graph API ───────────────────────────────────────────────

async function sendMetaMessage(
  recipientId: string,
  text: string,
  pageAccessToken: string,
  platform: MetaPlatform
) {
  const url =
    platform === "instagram"
      ? "https://graph.facebook.com/v21.0/me/messages"
      : "https://graph.facebook.com/v21.0/me/messages";

  const res = await fetch(`${url}?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(`Meta send error (${platform}):`, JSON.stringify(err));
  }
}

// ─── Webhook Verification (GET) ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Meta webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ─── Webhook Handler (POST) ───────────────────────────────────────────────────

// ─── Token resolver ───────────────────────────────────────────────────────────

function resolvePageToken(pageId: string): string {
  // Map page IDs to their respective tokens
  const tokenMap: Record<string, string> = {
    [process.env.META_PAGE_ID_1 ?? ""]: process.env.META_PAGE_ACCESS_TOKEN ?? "",
    [process.env.META_PAGE_ID_2 ?? ""]: process.env.META_PAGE_ACCESS_TOKEN_2 ?? "",
  };
  return tokenMap[pageId] ?? process.env.META_PAGE_ACCESS_TOKEN ?? "";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY");
    return new NextResponse("OK", { status: 200 });
  }

  try {
    // ── Security: Meta signature validation ────────────────────────────────
    const rawBody = Buffer.from(await req.arrayBuffer());
    const signature = req.headers.get("x-hub-signature-256");

    if (!validateMetaSignature(signature, rawBody)) {
      console.warn("Meta webhook: invalid signature — rejected");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = JSON.parse(rawBody.toString("utf-8"));

    // Determine platform
    const platform: MetaPlatform =
      body.object === "instagram" ? "instagram" : "messenger";

    const entries = body.entry ?? [];

    for (const entry of entries) {
      // entry.id is the page ID that received the message
      const pageId = entry.id ?? "";
      const pageAccessToken = resolvePageToken(pageId);

      const messagingEvents =
        entry.messaging ?? entry.changes?.flatMap((c: any) => c.value?.messages ?? []) ?? [];

      for (const event of messagingEvents) {
        // Skip non-message events (postbacks, reactions, etc.)
        const messageText =
          event.message?.text ??
          event.value?.messages?.[0]?.text?.body ??
          null;

        const senderId =
          event.sender?.id ??
          event.value?.messages?.[0]?.from ??
          null;

        if (!senderId || !messageText) continue;

        // Skip messages sent by the page itself
        if (event.message?.is_echo) continue;

        // Rate limiting per sender
        if (!checkRateLimit(`meta:${senderId}`)) {
          console.warn(`Meta webhook: rate limit hit for sender ${senderId}`);
          continue;
        }

        const supabase = createSupabaseAdminClient();

        // Get conversation history
        const { id: convId, messages: history } = await getHistory(
          supabase,
          senderId,
          platform
        );

        // Generate AI reply
        const reply = await generateReply(messageText, history, platform, apiKey);
        const finalReply =
          reply ||
          "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊";

        // Save history (non-blocking)
        const updatedMessages: ChatMessage[] = [
          ...history,
          { role: "user", content: messageText },
          { role: "assistant", content: finalReply },
        ];
        void saveHistory(supabase, senderId, platform, convId, updatedMessages);

        // Send reply via Graph API
        await sendMetaMessage(senderId, finalReply, pageAccessToken, platform);
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Meta webhook error:", err);
    return new NextResponse("OK", { status: 200 });
  }
}
