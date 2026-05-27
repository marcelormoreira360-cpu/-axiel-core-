import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature } from "@/lib/webhook-guard";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG } from "@/services/whatsapp-bot-service";

export const runtime = "nodejs";

// ─── Meta message types ──────────────────────────────────────────────────────

type MetaTextMessage = { type: "text"; text: { body: string } };
type MetaAudioMessage = { type: "audio"; audio: { id: string; mime_type: string } };
type MetaMessage = (MetaTextMessage | MetaAudioMessage) & {
  from: string;
  id: string;
  timestamp: string;
};

type MetaWebhookBody = {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: MetaMessage[];
        statuses?: unknown[];
      };
      field: string;
    }>;
  }>;
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHistory(
  supabase: SupabaseAdmin,
  phone: string
): Promise<{ id: string | null; messages: ChatMessage[]; botDisabled: boolean; clinicId: string | null }> {
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

async function saveHistory(
  supabase: SupabaseAdmin,
  phone: string,
  id: string | null,
  messages: ChatMessage[],
  clinicId?: string | null
) {
  const payload: Record<string, unknown> = {
    phone,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  if (!id && clinicId) payload.clinic_id = clinicId;
  try {
    if (id) {
      await supabase.from("whatsapp_conversations").update(payload).eq("id", id);
    } else {
      await supabase.from("whatsapp_conversations").insert(payload);
    }
  } catch { /* non-blocking */ }
}

async function autoCreateLead(
  supabase: SupabaseAdmin,
  phone: string,
  clinicId: string,
  name: string,
  firstMessage: string
) {
  try {
    const [{ count: patientCount }, { count: leadCount }] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("phone", phone),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("phone", phone),
    ]);
    if ((patientCount ?? 0) > 0 || (leadCount ?? 0) > 0) return;

    await supabase.from("leads").insert({
      clinic_id: clinicId,
      full_name: name || `WhatsApp ${phone.slice(-4)}`,
      phone,
      source: "other",
      stage: "new_lead",
      notes: `Lead criado automaticamente via WhatsApp (Meta API).\nPrimeira mensagem: "${firstMessage.slice(0, 200)}"`,
    });
  } catch (e) {
    console.error("auto-create lead (Meta) failed:", e);
  }
}

// ─── Send reply via Meta Graph API ───────────────────────────────────────────

async function sendMetaReply(to: string, body: string, phoneNumberId: string): Promise<void> {
  const token = process.env.META_WHATSAPP_TOKEN;
  if (!token) throw new Error("META_WHATSAPP_TOKEN not set");

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body, preview_url: false },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    console.error("Meta send error:", JSON.stringify(err));
    throw new Error(`Meta API error: ${res.status}`);
  }
}

// ─── Download audio from Meta and transcribe via Whisper ─────────────────────

async function transcribeMetaAudio(mediaId: string, apiKey: string): Promise<string> {
  const token = process.env.META_WHATSAPP_TOKEN;
  if (!token) return "";

  try {
    // 1. Get media URL from Meta
    const urlRes = await fetch(
      `https://graph.facebook.com/v20.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!urlRes.ok) return "";
    const { url: mediaUrl } = await urlRes.json();
    if (!mediaUrl) return "";

    // 2. Download the audio file
    const audioRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!audioRes.ok) return "";

    const audioBuffer = await audioRes.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });

    // 3. Transcribe via OpenAI Whisper
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) return "";
    const data = await whisperRes.json();
    return data.text?.trim() ?? "";
  } catch (err) {
    console.error("Meta audio transcription error:", err);
    return "";
  }
}

// ─── AI reply ────────────────────────────────────────────────────────────────

async function generateReply(
  incomingMessage: string,
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
        { role: "user", content: incomingMessage },
      ],
      temperature: 0.7,
      max_tokens: 450,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("OpenAI error (Meta webhook):", res.status, JSON.stringify(data));
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── GET — Meta webhook verification ─────────────────────────────────────────
// Meta calls GET with hub.challenge to verify the endpoint owns the callback URL.

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("Meta webhook verified successfully");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("Meta webhook verification failed — token mismatch or missing params");
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — incoming WhatsApp messages ───────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log("[whatsapp] POST received");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[whatsapp] OPENAI_API_KEY not set");
    return new NextResponse("", { status: 200 });
  }

  try {
    const rawBody = await req.text();
    console.log("[whatsapp] raw body length:", rawBody.length);

    // Validate Meta signature
    const signature = req.headers.get("x-hub-signature-256");
    if (!validateMetaSignature(signature, Buffer.from(rawBody))) {
      console.warn("[whatsapp] invalid signature — rejected. META_APP_SECRET set:", !!process.env.META_APP_SECRET);
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.log("[whatsapp] signature valid");

    const body: MetaWebhookBody = JSON.parse(rawBody);

    // Only handle WhatsApp messages
    if (body.object !== "whatsapp_business_account") {
      return new NextResponse("", { status: 200 });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];

        for (const message of messages) {
          // Only process inbound messages (not status updates)
          const fromPhone = message.from;
          const contactName = contacts.find((c) => c.wa_id === fromPhone)?.profile?.name ?? "";

          let incomingText = "";

          if (message.type === "text") {
            incomingText = (message as MetaTextMessage).text.body.trim();
          } else if (message.type === "audio") {
            const audioMsg = message as MetaAudioMessage;
            const transcribed = await transcribeMetaAudio(audioMsg.audio.id, apiKey);
            if (transcribed) {
              incomingText = transcribed;
            } else {
              await sendMetaReply(
                fromPhone,
                "Desculpe, não consegui processar o áudio. Pode digitar sua mensagem? 😊",
                phoneNumberId
              );
              continue;
            }
          } else {
            // Unsupported message type (image, doc, etc.) — ignore silently
            continue;
          }

          if (!incomingText) continue;

          const supabase = createSupabaseAdminClient();

          // Load clinic config — for now uses IFWC default
          // When multi-clinic is needed, look up by phoneNumberId
          const systemPrompt = buildSystemPrompt(IFWC_DEFAULT_CONFIG);
          const clinicId = null; // TODO: look up clinic by Meta phone_number_id

          const { id: convId, messages: history, botDisabled, clinicId: convClinicId } =
            await getHistory(supabase, fromPhone);

          // Human takeover — save message, don't reply
          if (botDisabled) {
            await saveHistory(supabase, fromPhone, convId, [
              ...history,
              { role: "user", content: incomingText },
            ], convClinicId ?? clinicId);
            continue;
          }

          // Auto-create lead for new contacts
          const effectiveClinicId = convClinicId ?? clinicId;
          if (effectiveClinicId && !convId) {
            void autoCreateLead(supabase, fromPhone, effectiveClinicId, contactName, incomingText);
          }

          // Reset command — clears conversation history for testing
          if (incomingText.toLowerCase().trim() === "reset") {
            await saveHistory(supabase, fromPhone, convId, [], effectiveClinicId);
            await sendMetaReply(fromPhone, "Conversa reiniciada. Olá! 👋 Como posso ajudar?", phoneNumberId);
            console.log("[whatsapp] conversation reset for phone:", fromPhone.slice(-4));
            continue;
          }

          console.log("[whatsapp] generating reply for phone:", fromPhone.slice(-4));
          const reply = await generateReply(incomingText, history, systemPrompt, apiKey);
          console.log("[whatsapp] reply generated, length:", reply.length);
          const finalReply = reply || "Olá! Recebi sua mensagem. Em breve entraremos em contato. 😊";

          // Save history before sending reply to prevent race condition on rapid messages
          await saveHistory(
            supabase,
            fromPhone,
            convId,
            [...history, { role: "user", content: incomingText }, { role: "assistant", content: finalReply }],
            effectiveClinicId
          );

          // Send reply via Meta API
          console.log("[whatsapp] sending reply via Meta API, phoneNumberId:", phoneNumberId);
          await sendMetaReply(fromPhone, finalReply, phoneNumberId);
          console.log("[whatsapp] reply sent successfully");
        }
      }
    }

    // Meta requires a 200 response to acknowledge receipt
    return new NextResponse("", { status: 200 });
  } catch (err) {
    console.error("[whatsapp] webhook error:", err);
    // Always return 200 to Meta — otherwise it retries indefinitely
    return new NextResponse("", { status: 200 });
  }
}
