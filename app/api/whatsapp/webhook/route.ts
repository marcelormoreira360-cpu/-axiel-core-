import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG, getWhatsAppBotConfigByNumber } from "@/services/whatsapp-bot-service";

export const runtime = "nodejs";

// ─── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

// ─── Conversation History ────────────────────────────────────────────────────

async function getHistory(supabase: any, phone: string): Promise<{ id: string | null; messages: ChatMessage[] }> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages")
      .eq("phone", phone)
      .maybeSingle();
    return { id: data?.id ?? null, messages: (data?.messages as ChatMessage[]) ?? [] };
  } catch {
    return { id: null, messages: [] };
  }
}

async function saveHistory(supabase: any, phone: string, id: string | null, messages: ChatMessage[]) {
  const payload = { phone, messages: messages.slice(-20), updated_at: new Date().toISOString() };
  try {
    if (id) {
      await supabase.from("whatsapp_conversations").update(payload).eq("id", id);
    } else {
      await supabase.from("whatsapp_conversations").insert(payload);
    }
  } catch {
    // non-blocking
  }
}

// ─── AI Reply ────────────────────────────────────────────────────────────────

async function generateReply(
  incomingMessage: string,
  history: ChatMessage[],
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-12),
    { role: "user" as const, content: incomingMessage },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 450,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Twilio body parser ──────────────────────────────────────────────────────

async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const obj: Record<string, string> = {};
  params.forEach((v, k) => { obj[k] = v; });
  return obj;
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new NextResponse("", { status: 200 });

  try {
    const body = await parseBody(req);
    const fromNumber = body["From"]?.replace("whatsapp:", "") ?? "";
    const toNumber = body["To"]?.replace("whatsapp:", "") ?? "";
    const incomingMessage = body["Body"]?.trim() ?? "";

    if (!fromNumber || !incomingMessage) return new NextResponse("", { status: 200 });

    const supabase = await createSupabaseServerClient();

    // Load clinic-specific bot config or fall back to IFWC default
    let systemPrompt: string;
    try {
      const config = toNumber ? await getWhatsAppBotConfigByNumber(toNumber) : null;
      systemPrompt = buildSystemPrompt(config ?? IFWC_DEFAULT_CONFIG);
    } catch {
      systemPrompt = buildSystemPrompt(IFWC_DEFAULT_CONFIG);
    }

    // Get conversation history
    const { id: convId, messages: history } = await getHistory(supabase, fromNumber);

    // Generate reply using clinic config
    const reply = await generateReply(incomingMessage, history, systemPrompt, apiKey);

    if (!reply) {
      await sendWhatsAppText(fromNumber, "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊");
      return new NextResponse("", { status: 200 });
    }

    // Save updated history (non-blocking)
    const updatedMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: incomingMessage },
      { role: "assistant", content: reply },
    ];
    void saveHistory(supabase, fromNumber, convId, updatedMessages);

    // Send reply
    await sendWhatsAppText(fromNumber, reply);

    return new NextResponse("", { status: 200 });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return new NextResponse("", { status: 200 });
  }
}

export async function GET() {
  return new NextResponse("OK", { status: 200 });
}
