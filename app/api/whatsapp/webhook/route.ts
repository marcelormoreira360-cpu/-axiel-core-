import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
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
  if (!res.ok) {
    console.error("OpenAI error:", res.status, JSON.stringify(data));
    return "";
  }
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

// ─── Audio transcription via Whisper ─────────────────────────────────────────

async function transcribeAudio(mediaUrl: string, apiKey: string): Promise<string> {
  try {
    // Fetch the audio file from Twilio (requires Basic Auth)
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const authHeader = "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");

    const audioRes = await fetch(mediaUrl, { headers: { Authorization: authHeader } });
    if (!audioRes.ok) {
      console.error("Failed to fetch audio from Twilio:", audioRes.status);
      return "";
    }

    const audioBuffer = await audioRes.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });

    // Send to Whisper
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json();
      console.error("Whisper error:", JSON.stringify(err));
      return "";
    }

    const data = await whisperRes.json();
    return data.text?.trim() ?? "";
  } catch (err) {
    console.error("Audio transcription error:", err);
    return "";
  }
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new NextResponse("", { status: 200 });

  try {
    const body = await parseBody(req);
    const fromNumber = body["From"]?.replace("whatsapp:", "") ?? "";
    const toNumber = body["To"]?.replace("whatsapp:", "") ?? "";
    let incomingMessage = body["Body"]?.trim() ?? "";

    // Handle audio messages
    const mediaUrl = body["MediaUrl0"] ?? "";
    const mediaType = body["MediaContentType0"] ?? "";
    const isAudio = mediaType.startsWith("audio/");

    if (!fromNumber) return new NextResponse("", { status: 200 });

    // If audio, transcribe it
    if (isAudio && mediaUrl) {
      const transcribed = await transcribeAudio(mediaUrl, apiKey);
      if (transcribed) {
        incomingMessage = transcribed;
      } else {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Desculpe, não consegui processar o áudio. Pode digitar sua mensagem? 😊</Message></Response>`;
        return new NextResponse(twiml, { status: 200, headers: { "Content-Type": "text/xml" } });
      }
    }

    if (!incomingMessage) return new NextResponse("", { status: 200 });

    const supabase = createSupabaseAdminClient();

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

    const finalReply = reply || "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊";

    // Save updated history (non-blocking)
    const updatedMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: incomingMessage },
      { role: "assistant", content: finalReply },
    ];
    void saveHistory(supabase, fromNumber, convId, updatedMessages);

    // Respond via TwiML (works for both sandbox and production)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${finalReply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message></Response>`;
    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return new NextResponse("", { status: 200 });
  }
}

export async function GET() {
  return new NextResponse("OK", { status: 200 });
}
