import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG, getWhatsAppBotConfigByNumber } from "@/services/whatsapp-bot-service";
import { validateTwilioSignature, checkRateLimit } from "@/lib/webhook-guard";

export const runtime = "nodejs";

// ─── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;
type BotConfig = { clinic_id?: string | null; [key: string]: unknown };

// ─── Conversation History ────────────────────────────────────────────────────

async function getHistory(supabase: SupabaseAdmin, phone: string): Promise<{ id: string | null; messages: ChatMessage[]; botDisabled: boolean; clinicId: string | null }> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled, clinic_id")
      .eq("phone", phone)
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

// Auto-create lead when unknown number contacts
async function autoCreateLead(supabase: SupabaseAdmin, phone: string, clinicId: string, firstMessage: string) {
  try {
    // Check if already a patient or lead with this phone
    const [{ count: patientCount }, { count: leadCount }] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("phone", phone),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("phone", phone),
    ]);
    if ((patientCount ?? 0) > 0 || (leadCount ?? 0) > 0) return; // already known

    await supabase.from("leads").insert({
      clinic_id: clinicId,
      full_name: `WhatsApp ${phone.slice(-4)}`,
      phone,
      source: "other",
      stage: "new_lead",
      notes: `Lead criado automaticamente via WhatsApp.\nPrimeira mensagem: "${firstMessage.slice(0, 200)}"`,
    });
  } catch (e) {
    console.error("auto-create lead failed:", e);
  }
}

async function saveHistory(supabase: SupabaseAdmin, phone: string, id: string | null, messages: ChatMessage[], clinicId?: string | null) {
  const payload: Record<string, unknown> = { phone, messages: messages.slice(-20), updated_at: new Date().toISOString() };
  if (!id && clinicId) payload.clinic_id = clinicId;
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
    // ── Security: Twilio signature validation ──────────────────────────────
    const rawBody = await req.text();
    const signature = req.headers.get("x-twilio-signature");
    const url = `https://${req.headers.get("host")}${req.nextUrl.pathname}`;
    const params: Record<string, string> = {};
    new URLSearchParams(rawBody).forEach((v, k) => { params[k] = v; });

    if (!validateTwilioSignature(signature, url, params)) {
      console.warn("WhatsApp webhook: invalid Twilio signature — rejected");
      return new NextResponse("Forbidden", { status: 403 });
    }

    // ── Rate limiting (best-effort per instance) ───────────────────────────
    const fromRaw = params["From"] ?? "";
    if (!checkRateLimit(`wa:${fromRaw}`)) {
      console.warn(`WhatsApp webhook: rate limit hit for ${fromRaw}`);
      return new NextResponse("", { status: 200 }); // silent 200 to Twilio
    }

    const fromNumber = params["From"]?.replace("whatsapp:", "") ?? "";
    const toNumber = params["To"]?.replace("whatsapp:", "") ?? "";
    let incomingMessage = params["Body"]?.trim() ?? "";

    // Handle audio messages
    const mediaUrl = params["MediaUrl0"] ?? "";
    const mediaType = params["MediaContentType0"] ?? "";
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
    let clinicIdFromConfig: string | null = null;
    try {
      const config = toNumber ? await getWhatsAppBotConfigByNumber(toNumber) : null;
      clinicIdFromConfig = (config as BotConfig)?.clinic_id ?? null;
      systemPrompt = buildSystemPrompt(config ?? IFWC_DEFAULT_CONFIG);
    } catch {
      systemPrompt = buildSystemPrompt(IFWC_DEFAULT_CONFIG);
    }

    // Get conversation history + check bot_disabled
    const { id: convId, messages: history, botDisabled, clinicId: convClinicId } = await getHistory(supabase, fromNumber);

    // If human has taken over, save the user message but don't reply
    if (botDisabled) {
      const updatedMessages: ChatMessage[] = [
        ...history,
        { role: "user", content: incomingMessage },
      ];
      void saveHistory(supabase, fromNumber, convId, updatedMessages, convClinicId ?? clinicIdFromConfig);
      return new NextResponse("", { status: 200 }); // silent — human is handling
    }

    // Auto-create lead for new unknown contacts
    const effectiveClinicId = convClinicId ?? clinicIdFromConfig;
    if (effectiveClinicId && !convId) {
      void autoCreateLead(supabase, fromNumber, effectiveClinicId, incomingMessage);
    }

    // Generate reply using clinic config
    const reply = await generateReply(incomingMessage, history, systemPrompt, apiKey);

    const finalReply = reply || "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊";

    // Save updated history (non-blocking)
    const updatedMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: incomingMessage },
      { role: "assistant", content: finalReply },
    ];
    void saveHistory(supabase, fromNumber, convId, updatedMessages, effectiveClinicId);

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
