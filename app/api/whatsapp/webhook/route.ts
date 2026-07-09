import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG, getWhatsAppBotConfigByNumber, funnelStepFromHistory } from "@/services/whatsapp-bot-service";
import { validateTwilioSignature, checkRateLimitDb } from "@/lib/webhook-guard";
import { shouldSilenceAi } from "@/lib/whatsapp-handoff";
import { parseTwilioParams, twimlMessage } from "@/lib/twilio-webhook-utils";
import { getServerT, resolveChatLocaleByPhone } from "@/lib/email-i18n";
import { createLogger } from "@/lib/logger";
import {
  getConversationState,
  saveConversation,
  autoCreateLeadFromChannel,
  generateReply,
  clinicHasWhatsAppAutomation,
  type ChatMessage,
} from "@/services/twilio-bot-engine";

export const runtime = "nodejs";

const log = createLogger("twilio-whatsapp");

// A mecânica compartilhada com o canal de SMS (histórico, lead automático,
// resposta OpenAI, gate de plano) vive em services/twilio-bot-engine.ts.

type BotConfig = { clinic_id?: string | null; [key: string]: unknown };

// ─── Audio transcription via Whisper ─────────────────────────────────────────

async function transcribeAudio(mediaUrl: string, apiKey: string): Promise<string> {
  try {
    // Fetch the audio file from Twilio (requires Basic Auth)
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const authHeader = "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");

    const audioRes = await fetch(mediaUrl, { headers: { Authorization: authHeader } });
    if (!audioRes.ok) {
      log.error("failed to fetch audio from Twilio", { status: audioRes.status });
      return "";
    }

    const audioBuffer = await audioRes.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });

    // Send to Whisper
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");
    // BOT-03: removed hardcoded "pt" — Whisper auto-detects language

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json();
      log.error("Whisper error", { detail: JSON.stringify(err) });
      return "";
    }

    const data = await whisperRes.json();
    return data.text?.trim() ?? "";
  } catch (err) {
    log.error("audio transcription error", err);
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
    const params = parseTwilioParams(rawBody);

    if (!validateTwilioSignature(signature, url, params)) {
      console.warn("WhatsApp webhook: invalid Twilio signature — rejected");
      return new NextResponse("Forbidden", { status: 403 });
    }

    // ── Rate limiting — distributed (SEC-06: shared across all Vercel instances) ──
    const fromRaw = params["From"] ?? "";
    if (!(await checkRateLimitDb(`wa:${fromRaw}`, 20, 60_000))) {
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

    // Load clinic-specific bot config or fall back to IFWC default.
    // Carregado ANTES do tratamento de áudio para o auto-reply fixo sair no
    // idioma do paciente/clínica (resolveChatLocaleByPhone precisa do clinic_id).
    let botConfig: Parameters<typeof buildSystemPrompt>[0] = IFWC_DEFAULT_CONFIG;
    let clinicIdFromConfig: string | null = null;
    try {
      const config = toNumber ? await getWhatsAppBotConfigByNumber(toNumber) : null;
      clinicIdFromConfig = (config as BotConfig)?.clinic_id ?? null;
      if (config) botConfig = config;
    } catch { /* keep IFWC default */ }

    // If audio, transcribe it
    if (isAudio && mediaUrl) {
      const transcribed = await transcribeAudio(mediaUrl, apiKey);
      if (transcribed) {
        incomingMessage = transcribed;
      } else {
        const t = await getServerT(await resolveChatLocaleByPhone(fromNumber, clinicIdFromConfig), "whatsapp");
        const twiml = twimlMessage(t("autoReply.audioFail"));
        return new NextResponse(twiml, { status: 200, headers: { "Content-Type": "text/xml" } });
      }
    }

    if (!incomingMessage) return new NextResponse("", { status: 200 });

    const supabase = createSupabaseAdminClient();

    // Feature gate — whatsapp_automation requires Professional plan or above.
    // Falls back silently (silent 200) so Twilio doesn't retry.
    if (clinicIdFromConfig) {
      if (!(await clinicHasWhatsAppAutomation(supabase, clinicIdFromConfig))) {
        console.warn("[twilio] whatsapp_automation not available for clinic", clinicIdFromConfig);
        return new NextResponse("", { status: 200 });
      }
    }

    // Get conversation history + estado da passagem de bastão
    const { id: convId, messages: history, botDisabled, aiPaused, lastHumanMessageAt, clinicId: convClinicId, updatedAt } =
      await getConversationState(supabase, fromNumber);

    // Passo do funil estimado pelo histórico (sem isso o bot fica preso no
    // passo 1); conversa parada há 48h+ volta ao acolhimento.
    const step = funnelStepFromHistory(history.length, updatedAt);
    const systemPrompt = buildSystemPrompt(botConfig, step);

    // Passagem de bastão: se a IA está pausada OU um humano respondeu há menos
    // de 24h, salva a mensagem do paciente mas não responde.
    if (shouldSilenceAi({ aiPaused, botDisabled, lastHumanMessageAt })) {
      const updatedMessages: ChatMessage[] = [
        ...history,
        { role: "user", content: incomingMessage },
      ];
      void saveConversation(supabase, fromNumber, convId, updatedMessages, convClinicId ?? clinicIdFromConfig);
      return new NextResponse("", { status: 200 }); // silent — human is handling
    }

    // Auto-create lead for new unknown contacts
    const effectiveClinicId = convClinicId ?? clinicIdFromConfig;
    if (effectiveClinicId && !convId) {
      void autoCreateLeadFromChannel(supabase, {
        phone: fromNumber,
        clinicId: effectiveClinicId,
        firstMessage: incomingMessage,
        channelLabel: "WhatsApp",
      });
    }

    // Generate reply using clinic config
    const reply = await generateReply(incomingMessage, history, systemPrompt, apiKey);

    // Fallback fixo no idioma do paciente (patients.locale pelo telefone) e,
    // na falta, no idioma da clínica; sem clínica, pt-BR.
    let finalReply = reply;
    if (!finalReply) {
      const t = await getServerT(await resolveChatLocaleByPhone(fromNumber, effectiveClinicId), "whatsapp");
      finalReply = t("autoReply.fallback");
    }

    // BUG-02: await the save so history is persisted before next message arrives
    const updatedMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: incomingMessage },
      { role: "assistant", content: finalReply },
    ];
    await saveConversation(supabase, fromNumber, convId, updatedMessages, effectiveClinicId);

    // Respond via TwiML (works for both sandbox and production)
    return new NextResponse(twimlMessage(finalReply), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    log.error("webhook error", err);
    return new NextResponse("", { status: 200 });
  }
}

export async function GET() {
  return new NextResponse("OK", { status: 200 });
}
