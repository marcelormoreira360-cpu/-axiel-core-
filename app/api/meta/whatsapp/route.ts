import { NextRequest, NextResponse } from "next/server";
import { openaiChatCompletion } from "@/lib/openai-chat-fetch";
import { chatModel } from "@/lib/ai-models";
import { recordSttUsage } from "@/services/stt-usage-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature } from "@/lib/webhook-guard";
import { IFWC_DEFAULT_CONFIG, getWhatsAppBotConfigByMetaPhoneId } from "@/services/whatsapp-bot-service";
import type { PricingLocation } from "@/services/whatsapp-bot-service";
import { detectLanguage } from "@/lib/whatsapp-lang";
import type { Lang } from "@/lib/whatsapp-lang";
import { getServerT, resolveChatLocaleByPhone } from "@/lib/email-i18n";
import { createLogger } from "@/lib/logger";
import { canUseFeature } from "@/modules/billing/feature-access";
import { shouldSilenceAi } from "@/lib/whatsapp-handoff";
import { isDuplicateMetaMessage } from "@/lib/meta-dedup";

const log = createLogger("whatsapp");
import {
  stepFromHistory,
  buildFixedReply,
  isPriceQuestion,
  buildPriceObjectionReply,
  detectCity,
  buildPricingBlock,
  CITY_ALIASES,
} from "@/lib/whatsapp-bot-helpers";

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
// stepFromHistory, buildFixedReply, isPriceQuestion, buildPriceObjectionReply,
// detectCity, buildPricingBlock, CITY_ALIASES — imported from @/lib/whatsapp-bot-helpers

async function getHistory(
  supabase: SupabaseAdmin,
  phone: string
): Promise<{
  id: string | null;
  messages: ChatMessage[];
  botDisabled: boolean;
  aiPaused: boolean;
  lastHumanMessageAt: string | null;
  currentStepDb: number | null;
  clinicId: string | null;
  updatedAt: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled, ai_paused, last_human_message_at, current_step, clinic_id, updated_at")
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") {
      log.error("getHistory DB error", { code: error.code, message: error.message, phone: phone.slice(-4) });
    }
    const msgs = (data?.messages as ChatMessage[]) ?? [];
    const botDisabled = (data as unknown as { bot_disabled?: boolean } | null)?.bot_disabled ?? false;
    const aiPaused = (data as unknown as { ai_paused?: boolean } | null)?.ai_paused ?? false;
    const lastHumanMessageAt = (data as unknown as { last_human_message_at?: string | null } | null)?.last_human_message_at ?? null;
    const currentStepDb = (data as unknown as { current_step?: number } | null)?.current_step ?? null;
    const clinicId = (data as unknown as { clinic_id?: string | null } | null)?.clinic_id ?? null;
    const updatedAt = (data as unknown as { updated_at?: string } | null)?.updated_at ?? null;
    log.debug("getHistory", { id: data?.id ?? "null", msgs: msgs.length, bot_disabled: botDisabled, ai_paused: aiPaused, phone: phone.slice(-4) });
    return {
      id: data?.id ?? null,
      messages: msgs,
      botDisabled,
      aiPaused,
      lastHumanMessageAt,
      currentStepDb,
      clinicId,
      updatedAt,
    };
  } catch (e) {
    log.error("getHistory exception", e, { phone: phone.slice(-4) });
    return { id: null, messages: [], botDisabled: false, aiPaused: false, lastHumanMessageAt: null, currentStepDb: null, clinicId: null, updatedAt: null };
  }
}

async function saveHistory(
  supabase: SupabaseAdmin,
  phone: string,
  id: string | null,
  messages: ChatMessage[],
  clinicId?: string | null,
  currentStep?: number
) {
  const payload: Record<string, unknown> = {
    phone,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  // BUG-03: persist current_step so stepFromHistory() never miscounts on truncated history
  if (currentStep !== undefined) payload.current_step = currentStep;
  try {
    if (id) {
      // Row exists — UPDATE by ID
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update(payload)
        .eq("id", id);
      if (error) log.error("saveHistory UPDATE error", { message: error.message });
    } else {
      // New row — UPSERT on phone (safe against concurrent first messages)
      if (clinicId) payload.clinic_id = clinicId;
      const { error } = await supabase
        .from("whatsapp_conversations")
        .upsert(payload, { onConflict: "phone" });
      if (error) log.error("saveHistory UPSERT error", { message: error.message });
    }
  } catch (e) { log.error("saveHistory exception", e); }
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
    log.error("autoCreateLead failed", e, { clinic_id: clinicId, phone: phone.slice(-4) });
  }
}

// ─── Send reply via Meta Graph API ───────────────────────────────────────────

// INT-03: retry with exponential backoff for 429 and 5xx
// INT-04: 15s timeout per attempt to avoid Vercel edge timeouts
async function sendMetaReply(to: string, body: string, phoneNumberId: string, attempt = 1): Promise<void> {
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
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body, preview_url: false },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Retry on rate-limit (429) or server error (5xx), up to 3 attempts
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const delay = attempt * 2000; // 2s, 4s
      log.warn(`sendMetaReply attempt ${attempt} failed — retrying`, { status: res.status, delay_ms: delay, phone: to.slice(-4) });
      await new Promise((r) => setTimeout(r, delay));
      return sendMetaReply(to, body, phoneNumberId, attempt + 1);
    }
    log.error("sendMetaReply failed", { status: res.status, body: JSON.stringify(err) });
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
    // Teto de 25 MB (limite duro do Whisper): fecha o custo de STT sem limite em
    // mídia grande/maliciosa (paridade com transcribe/route.ts).
    if (audioBuffer.byteLength > 25 * 1024 * 1024) return "";
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });

    // 3. Transcribe via OpenAI Whisper
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");
    // verbose_json traz a duração do áudio para medir uso de STT por minuto.
    formData.append("response_format", "verbose_json");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) return "";
    const data = await whisperRes.json();
    // A clínica ainda não foi resolvida neste ponto do webhook (SEC-01 acontece
    // depois), então registra sem clinic_id — conta o total de STT do canal.
    void recordSttUsage({ clinicId: null, channel: "meta_whatsapp", seconds: Number(data.duration) || 0 });
    return data.text?.trim() ?? "";
  } catch (err) {
    log.error("audio transcription failed", err, { media_id: mediaId });
    return "";
  }
}

// ─── Language detection ───────────────────────────────────────────────────────
// detectLanguage and Lang are imported from @/lib/whatsapp-lang

// ─── City detection for step 4 ───────────────────────────────────────────────

// ─── AI reply helper ─────────────────────────────────────────────────────────

async function generateOpenAIReply(
  systemPrompt: string,
  userMessage: string,
  historyContext: ChatMessage[],
  apiKey: string
): Promise<string> {
  try {
    const res = await openaiChatCompletion(apiKey, {
      model: chatModel(),
      messages: [
        { role: "system", content: systemPrompt },
        ...historyContext.slice(-2),
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 450,
    });

    const data = await res.json();
    if (!res.ok) {
      log.error("OpenAI API error", { status: res.status, body: JSON.stringify(data) });
      return "";
    }
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    // Timeout (AbortSignal) ou falha de rede → resposta vazia (o chamador usa fallback).
    log.error("OpenAI request failed or timed out", err);
    return "";
  }
}

// ─── Step 2 — qualification questions (OpenAI) ────────────────────────────────

async function generateStep2Reply(
  userMessage: string,
  config: typeof IFWC_DEFAULT_CONFIG,
  apiKey: string,
  lang: Lang
): Promise<string> {
  const system =
    lang === "en"
      ? `You are an assistant for ${config.clinic_name}. Respond in English, warm and professional tone, WhatsApp style, short messages. The patient shared their reason for contact. Your task: validate with 1 empathetic sentence + ask 4 questions together in a single numbered message: (1) How long have you been experiencing this? (2) Does this mainly affect pain, sleep, anxiety, energy, digestion, fatigue, or your emotional state? (3) Have you tried other treatments before? (4) What would you most like to improve in the next 60 days? Do not explain the program, do not show prices.`
      : `Você é assistente de ${config.clinic_name}. Responda em português brasileiro, tom acolhedor, estilo WhatsApp, mensagens curtas. O paciente informou o motivo do contato. Sua tarefa: valide em 1 frase de empatia + faça as 4 perguntas juntas numa única mensagem numerada: (1) Há quanto tempo você sente isso? (2) Isso afeta mais dor, sono, ansiedade, energia, intestino, cansaço ou parte emocional? (3) Você já fez outros tratamentos antes? (4) O que você mais gostaria de melhorar nos próximos 60 dias? Não explique programa, não mostre valores.`;
  return generateOpenAIReply(system, userMessage, [], apiKey);
}

// ─── Step 3 — present program + ask city (OpenAI) ────────────────────────────

async function generateStep3Reply(
  userMessage: string,
  history: ChatMessage[],
  config: typeof IFWC_DEFAULT_CONFIG,
  apiKey: string,
  lang: Lang
): Promise<string> {
  const cityList = config.locations.map((l) => l.city).join(", ");
  const system =
    lang === "en"
      ? `You are an assistant for ${config.clinic_name}. Warm, professional tone, WhatsApp style. The patient answered the qualification questions. Your task: validate with empathy in 2-3 sentences, then explain the program: ${config.methodology}. End by asking: 'Are you in ${cityList} or another city?'`
      : `Você é assistente de ${config.clinic_name}. Tom acolhedor, estilo WhatsApp. O paciente respondeu as perguntas de qualificação. Sua tarefa: valide com empatia em 2-3 frases, depois explique o programa: ${config.methodology}. Termine perguntando: 'Você está em ${cityList} ou outra cidade?'`;
  return generateOpenAIReply(system, userMessage, history, apiKey);
}

// isPriceQuestion and buildPriceObjectionReply imported from @/lib/whatsapp-bot-helpers

// ─── Feature gate helper ──────────────────────────────────────────────────────
/**
 * Returns true if the clinic's plan includes whatsapp_automation.
 * Uses the admin client — safe for webhook handlers (no cookie/session needed).
 * Falls back to "starter" (no access) on any DB error, preventing unplanned bot usage.
 */
async function clinicCanUseWhatsAppBot(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  clinicId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("subscriptions")
      .select("plans(code, slug)")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    const plans = data?.plans as { code?: string | null; slug?: string | null } | null;
    const planSlug = plans?.code ?? plans?.slug ?? "starter";
    return canUseFeature({ planSlug }, "whatsapp_automation");
  } catch {
    // Fail closed — if we can't verify the plan, don't run the bot
    return false;
  }
}

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    log.info("webhook verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  log.warn("webhook verification failed — token mismatch or missing params");
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — incoming WhatsApp messages ───────────────────────────────────────

export async function POST(req: NextRequest) {
  log.debug("POST received");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.error("OPENAI_API_KEY not set — dropping request");
    return new NextResponse("", { status: 200 });
  }

  try {
    const rawBody = await req.text();
    log.debug("raw body received", { length: rawBody.length });

    // Validate Meta signature
    const signature = req.headers.get("x-hub-signature-256");
    if (!validateMetaSignature(signature, Buffer.from(rawBody))) {
      log.warn("invalid signature — rejected", { meta_app_secret_set: !!process.env.META_APP_SECRET });
      return new NextResponse("Forbidden", { status: 403 });
    }
    log.debug("signature valid");

    const body: MetaWebhookBody = JSON.parse(rawBody);

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

        // BUG-07: skip message if phoneNumberId is missing — can't send reply without it
        if (!phoneNumberId) {
          log.warn("skipping message: phone_number_id missing in metadata");
          continue;
        }

        for (const message of messages) {
          // BUG-02: create one shared client per message — reused in all branches
          // (audio peek, unsupported-type peek, and the main conversation flow)
          const supabase = createSupabaseAdminClient();

          // Dedup (PRIMEIRA checagem): a Meta reenvia o webhook quando não
          // recebe 200 rápido (o LLM demora), e cada reenvio do MESMO evento
          // gerava uma nova resposta do bot. Se o id da mensagem já foi
          // processado, é retry — pula. Mensagens sem id seguem o fluxo normal.
          if (await isDuplicateMetaMessage(supabase, message.id)) {
            log.info("mensagem duplicada (retry da Meta) — ignorada", { mid: message.id });
            continue;
          }

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
              // Peek at history to choose language for the fallback message
              const { messages: peekHistory } = await getHistory(supabase, fromPhone);
              const peekLang = detectLanguage(peekHistory, "");
              const audioFallback =
                peekLang === "en"
                  ? "Sorry, I couldn't process the audio. Could you type your message? 😊"
                  : "Desculpe, não consegui processar o áudio. Pode digitar sua mensagem? 😊";
              await sendMetaReply(fromPhone, audioFallback, phoneNumberId);
              continue;
            }
          } else {
            // BOT-01: unsupported types (image, video, sticker, document, location)
            // Peek at history to pick the right language for the fallback
            const { messages: peekMsgs } = await getHistory(supabase, fromPhone);
            const peekLangType = detectLanguage(peekMsgs, "");
            const unsupportedMsg =
              peekLangType === "en"
                ? "I received your file! Unfortunately I can only process text and audio for now. Could you describe what you're sending? 😊"
                : "Recebi seu arquivo! Infelizmente só consigo processar texto e áudio por enquanto. Pode me descrever o que está enviando? 😊";
            if (phoneNumberId) {
              await sendMetaReply(fromPhone, unsupportedMsg, phoneNumberId).catch(() => {});
            }
            continue;
          }

          if (!incomingText) continue;

          // SEC-02: resolve clinic_id from Meta phone_number_id via whatsapp_bot_configs.
          // SEC-01: no fallback to IFWC_DEFAULT_CONFIG — if no clinic found, drop message silently.
          const botConfig = await getWhatsAppBotConfigByMetaPhoneId(phoneNumberId).catch(() => null);
          if (!botConfig) {
            log.warn("no clinic config found — dropping message", { phone_number_id: phoneNumberId });
            continue;
          }
          const clinicId = botConfig.clinic_id;
          const config = botConfig;

          // Push notification to clinic staff (fire-and-forget)
          import("@/services/push-service").then(({ sendPushToClinic }) =>
            sendPushToClinic(clinicId, {
              title: "Nova mensagem WhatsApp",
              body: `+${fromPhone.slice(-4).padStart(6, "·")} · ${incomingText.slice(0, 80)}${incomingText.length > 80 ? "…" : ""}`,
              url:   "/messages",
              tag:   `whatsapp-${fromPhone}`,
            }).catch(() => {})
          ).catch(() => {});

          // Feature gate — whatsapp_automation requires Scale plan or higher.
          // Drop silently so the patient sees no error message from an unauthorized bot.
          const botAllowed = await clinicCanUseWhatsAppBot(supabase, clinicId);
          if (!botAllowed) {
            log.warn("clinic plan does not include whatsapp_automation — dropping message", {
              clinic_id: clinicId,
              phone_number_id: phoneNumberId,
            });
            continue;
          }

          const {
            id: convId,
            messages: history,
            botDisabled,
            aiPaused,
            lastHumanMessageAt,
            currentStepDb,
            clinicId: convClinicId,
            updatedAt: convUpdatedAt,
          } = await getHistory(supabase, fromPhone);

          const effectiveClinicId = convClinicId ?? clinicId;

          // UX-02: auto-reset conversation if idle for more than 72h
          const CONVERSATION_TIMEOUT_MS = 72 * 60 * 60 * 1000;
          const isTimedOut = convUpdatedAt
            ? Date.now() - new Date(convUpdatedAt).getTime() > CONVERSATION_TIMEOUT_MS
            : false;
          const activeHistory = isTimedOut ? [] : history;
          const activeStepDb = isTimedOut ? null : currentStepDb;
          if (isTimedOut && convId) {
            log.info("conversation timed out — resetting step", { phone: fromPhone.slice(-4) });
          }

          // Step: prefer DB-persisted value (immune to truncation); fall back to count
          const currentStep = stepFromHistory(activeHistory, activeStepDb);

          // Language — detected from first user message and stable for the whole conversation
          const lang: Lang = detectLanguage(activeHistory, incomingText);

          log.info("dispatch", {
            step: currentStep,
            lang,
            bot_msgs: activeHistory.filter(m => m.role === "assistant").length,
            phone: fromPhone.slice(-4),
            ...(isTimedOut ? { timeout_reset: true } : {}),
          });

          // Passagem de bastão: IA pausada ou humano respondeu há menos de 24h.
          // Salva a mensagem do paciente e não responde.
          if (shouldSilenceAi({ aiPaused, botDisabled, lastHumanMessageAt })) {
            await saveHistory(supabase, fromPhone, convId, [
              ...activeHistory,
              { role: "user", content: incomingText },
            ], effectiveClinicId);
            continue;
          }

          // Reset command (accept both languages)
          const resetTrigger = incomingText.toLowerCase().trim();
          if (resetTrigger === "reset" || resetTrigger === "reiniciar") {
            await saveHistory(supabase, fromPhone, convId, [], effectiveClinicId, 1);
            const resetMsg = lang === "en" ? "Conversation reset. 👋 How can I help you?" : "Conversa reiniciada. 👋 Como posso ajudar?";
            await sendMetaReply(fromPhone, resetMsg, phoneNumberId);
            log.info("conversation reset", { phone: fromPhone.slice(-4) });
            continue;
          }

          // ─── NPS response detection ──────────────────────────────────────
          // If the patient replies with a digit 1-5, check whether they received
          // an NPS follow-up message in the last 48h for this clinic. If so, save
          // their score and optionally follow up with a Google Review link (≥ 4).
          const npsDigit = incomingText.trim();
          if (/^[1-5]$/.test(npsDigit)) {
            const npsScore = parseInt(npsDigit, 10);
            const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

            // Step 1: find patient by phone (with or without leading "+")
            const { data: patient } = await supabase
              .from("patients")
              .select("id")
              .eq("clinic_id", effectiveClinicId)
              .or(`phone.eq.${fromPhone},phone.eq.+${fromPhone}`)
              .maybeSingle();

            if (patient?.id) {
              // Step 2: find most recent completed NPS follow-up in the last 48h
              const { data: npsFu } = await supabase
                .from("follow_ups")
                .select("id, appointment_id, clinic_id")
                .eq("notes", "nps")
                .eq("status", "completed")
                .eq("clinic_id", effectiveClinicId)
                .eq("patient_id", patient.id)
                .gte("updated_at", cutoff)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (npsFu?.appointment_id) {
                // Step 3: ensure no feedback exists yet (UNIQUE constraint on appointment_id)
                const { data: existing } = await supabase
                  .from("session_feedback")
                  .select("id")
                  .eq("appointment_id", npsFu.appointment_id)
                  .maybeSingle();

                if (!existing) {
                  // Map 1-5 → 2-10 (DB stores 0–10 NPS scale)
                  const dbScore = npsScore * 2;

                  await supabase.from("session_feedback").upsert({
                    clinic_id:      npsFu.clinic_id,
                    patient_id:     patient.id,
                    appointment_id: npsFu.appointment_id,
                    nps_score:      dbScore,
                  }, { onConflict: "appointment_id", ignoreDuplicates: true });

                  // Fetch Google Review URL if score is high enough
                  let reviewUrl: string | null = null;
                  if (npsScore >= 4) {
                    const { data: cs } = await supabase
                      .from("clinic_settings")
                      .select("settings")
                      .eq("clinic_id", npsFu.clinic_id)
                      .maybeSingle();
                    reviewUrl = (cs?.settings as Record<string, unknown> | null)?.google_review_url as string | null ?? null;
                  }

                  let npsReply: string;
                  if (npsScore >= 4 && reviewUrl) {
                    npsReply =
                      `Obrigado pela sua avaliação! ${npsDigit}⭐ Fico muito feliz. 🙏\n\n` +
                      `Que tal compartilhar sua experiência no Google? Sua opinião ajuda outras pessoas a encontrar cuidado de qualidade:\n${reviewUrl}`;
                  } else if (npsScore >= 4) {
                    npsReply = `Obrigado pela sua avaliação! ${npsDigit}⭐ Fico feliz que tenha gostado. 🙏`;
                  } else {
                    npsReply =
                      `Obrigado pelo feedback! 🙏\n\n` +
                      `Lamento que a experiência não tenha sido tão boa quanto esperávamos. ` +
                      `Vamos trabalhar para melhorar.`;
                  }

                  await sendMetaReply(fromPhone, npsReply, phoneNumberId);
                  log.info("nps response captured via whatsapp", {
                    phone: fromPhone.slice(-4),
                    score: dbScore,
                    google_prompted: !!(npsScore >= 4 && reviewUrl),
                  });
                  continue;
                }
              }
            }
          }
          // ─────────────────────────────────────────────────────────────────────

          // Price objection — answer without advancing step
          if (currentStep !== 4 && isPriceQuestion(incomingText, lang)) {
            const objectionReply = buildPriceObjectionReply(currentStep, config, lang);
            const updatedMessages = [
              ...activeHistory,
              { role: "user" as const, content: incomingText },
              { role: "assistant" as const, content: objectionReply },
            ];
            await saveHistory(supabase, fromPhone, convId, updatedMessages, effectiveClinicId, currentStep);
            await sendMetaReply(fromPhone, objectionReply, phoneNumberId);
            continue;
          }

          // ─── Step dispatch ───────────────────────────────────────────────
          let reply = "";
          let nextStep = currentStep;

          if (currentStep === 1) {
            // Fixed welcome template — no OpenAI
            reply = buildFixedReply(1, incomingText, config, lang);
            nextStep = 2;
          } else if (currentStep === 2) {
            // OpenAI: empathy + 4 qualification questions
            reply = await generateStep2Reply(incomingText, config, apiKey, lang);
            nextStep = 3;
          } else if (currentStep === 3) {
            // OpenAI: validate answers + present program + ask city
            reply = await generateStep3Reply(incomingText, activeHistory.slice(-2), config, apiKey, lang);
            nextStep = 4;
          } else if (currentStep === 4) {
            // Fixed: show pricing for detected city
            reply = buildFixedReply(4, incomingText, config, lang);
            nextStep = 5;
          } else if (currentStep === 5) {
            // Fixed: morning or afternoon?
            reply = buildFixedReply(5, incomingText, config, lang);
            nextStep = 6;
          } else if (currentStep === 6) {
            // Fixed: ask name
            reply = buildFixedReply(6, incomingText, config, lang);
            nextStep = 7;
          } else if (currentStep === 7) {
            // Fixed: confirm + scheduling link
            reply = buildFixedReply(7, incomingText, config, lang);
            nextStep = 8;
          } else {
            // Step 8+: terminal — already confirmed, short reply
            reply = buildFixedReply(8, incomingText, config, lang);
            nextStep = 8; // stays at 8
          }

          // Fallback fixo no idioma do paciente (patients.locale pelo telefone)
          // e, na falta, no idioma da clínica; sem clínica, pt-BR.
          let finalReply = reply;
          if (!finalReply) {
            const tReply = await getServerT(
              await resolveChatLocaleByPhone(fromPhone, effectiveClinicId),
              "whatsapp",
            );
            finalReply = tReply("autoReply.fallback");
          }

          const updatedHistory = [
            ...activeHistory,
            { role: "user" as const, content: incomingText },
            { role: "assistant" as const, content: finalReply },
          ];
          // Save history + persist current_step so truncation never causes step regression
          await saveHistory(supabase, fromPhone, convId, updatedHistory, effectiveClinicId, nextStep);

          // BUG-05: auto-create lead AFTER saveHistory to avoid race condition on first message.
          // Fire-and-forget (non-blocking) but log failures for observability.
          if (effectiveClinicId && !convId) {
            autoCreateLead(supabase, fromPhone, effectiveClinicId, contactName, incomingText).catch((e) => {
              log.warn("autoCreateLead failed", { error: e instanceof Error ? e.message : String(e) });
            });
          }

          log.info("step saved — reply queued", {
            step: currentStep,
            next_step: nextStep,
            bot_msgs: updatedHistory.filter(m => m.role === "assistant").length,
          });
          await sendMetaReply(fromPhone, finalReply, phoneNumberId);
          log.debug("reply sent", { phone: fromPhone.slice(-4) });
        }
      }
    }

    return new NextResponse("", { status: 200 });
  } catch (err) {
    log.error("webhook unhandled error", err);
    return new NextResponse("", { status: 200 });
  }
}
