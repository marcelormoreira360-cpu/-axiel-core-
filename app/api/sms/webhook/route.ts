import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildSystemPrompt,
  IFWC_DEFAULT_CONFIG,
  getWhatsAppBotConfigByNumber,
  funnelStepFromHistory,
  type WhatsAppBotConfig,
} from "@/services/whatsapp-bot-service";
import { validateTwilioSignature, checkRateLimitDb } from "@/lib/webhook-guard";
import { getServerT, resolveChatLocaleByPhone } from "@/lib/email-i18n";
import { createLogger } from "@/lib/logger";
import { shouldSilenceAi } from "@/lib/whatsapp-handoff";
import { isDuplicateMetaMessage } from "@/lib/meta-dedup";
import { isOptOutRequest } from "@/lib/whatsapp-optout";
import {
  parseTwilioParams,
  twimlMessage,
  smsConversationKey,
  buildSmsChannelRule,
} from "@/lib/twilio-webhook-utils";
import { buildBookingUrl } from "@/lib/whatsapp-bot-helpers";
import {
  getConversationState,
  saveConversation,
  autoCreateLeadFromChannel,
  generateReply,
  clinicHasWhatsAppAutomation,
  type ChatMessage,
} from "@/services/twilio-bot-engine";

export const runtime = "nodejs";

// Canal de SMS da Clara (Twilio).
//
// Reaproveita o motor conversacional do WhatsApp Twilio
// (services/twilio-bot-engine.ts): mesma persona/funil de whatsapp_bot_configs,
// mesmo gate de passagem de bastão (lib/whatsapp-handoff) e mesmo opt-out de
// "falar com atendente" (lib/whatsapp-optout).
//
// Particularidades do canal:
// • From chega como telefone puro (+1...), sem o prefixo "whatsapp:".
// • A conversa é gravada em whatsapp_conversations com phone "sms_+1...",
//   para não colidir com a conversa de WhatsApp do MESMO número.
// • Dedup idempotente pelo MessageSid do Twilio na tabela
//   meta_processed_messages (o nome é histórico, da migration 116 do dedup da
//   Meta; hoje ela guarda ids de mensagem processados de qualquer canal).
// • O system prompt ganha a regra do canal (até ~300 caracteres, sem emoji) e
//   o link público de agendamento da clínica (paridade com o funil do WhatsApp).
// • Resposta via TwiML (<Response><Message>), como o webhook de WhatsApp.

const log = createLogger("sms");

// Fallback e opt-out do canal SMS (curtos, sem emoji) saem do namespace
// `whatsapp.autoReply.*` no idioma do paciente (patients.locale pelo telefone)
// e, na falta, no idioma da clínica; sem clínica, pt-BR.

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new NextResponse("", { status: 200 });

  try {
    // ── Security: Twilio signature validation (mesmo padrão do WhatsApp) ───
    const rawBody = await req.text();
    const signature = req.headers.get("x-twilio-signature");
    const url = `https://${req.headers.get("host")}${req.nextUrl.pathname}`;
    const params = parseTwilioParams(rawBody);

    if (!validateTwilioSignature(signature, url, params)) {
      console.warn("SMS webhook: invalid Twilio signature — rejected");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const fromNumber = params["From"] ?? "";
    // WhatsApp não pertence a este webhook (From viria "whatsapp:+1...")
    if (!fromNumber || fromNumber.startsWith("whatsapp:")) {
      return new NextResponse("", { status: 200 });
    }

    // ── Rate limiting — distributed ─────────────────────────────────────────
    if (!(await checkRateLimitDb(`sms:${fromNumber}`, 20, 60_000))) {
      console.warn(`SMS webhook: rate limit hit for ${fromNumber}`);
      return new NextResponse("", { status: 200 }); // silent 200 to Twilio
    }

    const toNumber = params["To"] ?? "";
    const incomingMessage = params["Body"]?.trim() ?? "";
    if (!incomingMessage) return new NextResponse("", { status: 200 });

    const supabase = createSupabaseAdminClient();

    // ── Dedup idempotente pelo MessageSid (retry do Twilio) ────────────────
    // Mesma tabela meta_processed_messages do dedup da Meta (nome histórico).
    if (await isDuplicateMetaMessage(supabase, params["MessageSid"])) {
      console.warn("[sms] mensagem duplicada (retry do Twilio) ignorada:", params["MessageSid"]);
      return new NextResponse("", { status: 200 });
    }

    // ── Config do bot da clínica (mesma persona/funil do WhatsApp) ─────────
    let botConfig: WhatsAppBotConfig | null = null;
    try {
      botConfig = toNumber ? await getWhatsAppBotConfigByNumber(toNumber) : null;
    } catch {
      botConfig = null;
    }
    const clinicIdFromConfig = botConfig?.clinic_id ?? null;

    // Feature gate — mesma regra do WhatsApp Twilio (whatsapp_automation)
    if (clinicIdFromConfig) {
      if (!(await clinicHasWhatsAppAutomation(supabase, clinicIdFromConfig))) {
        console.warn("[sms] whatsapp_automation not available for clinic", clinicIdFromConfig);
        return new NextResponse("", { status: 200 });
      }
    }

    // ── Histórico + passagem de bastão ─────────────────────────────────────
    const conversationKey = smsConversationKey(fromNumber);
    const { id: convId, messages: history, botDisabled, aiPaused, lastHumanMessageAt, clinicId: convClinicId, updatedAt } =
      await getConversationState(supabase, conversationKey);
    const effectiveClinicId = convClinicId ?? clinicIdFromConfig;

    // NB: a isolação multi-tenant do SMS vem da resolução por número
    // (getWhatsAppBotConfigByNumber): uma 2ª clínica que cadastra o próprio número
    // resolve para a config dela. Não há guarda por TWILIO_FROM_NUMBER aqui porque
    // esse env é o número de WhatsApp, não o DID de SMS/voz da clínica.

    // Passagem de bastão: IA pausada OU humano respondeu há menos de 24h.
    // Salva a mensagem do paciente e não responde.
    if (shouldSilenceAi({ aiPaused, botDisabled, lastHumanMessageAt })) {
      const updatedMessages: ChatMessage[] = [
        ...history,
        { role: "user", content: incomingMessage },
      ];
      void saveConversation(supabase, conversationKey, convId, updatedMessages, effectiveClinicId, "sms");
      return new NextResponse("", { status: 200 }); // silent — human is handling
    }

    // ── Opt-out / escalonamento humano ("falar com atendente") ─────────────
    // Responde uma vez, marca a conversa para um humano assumir e silencia.
    if (isOptOutRequest(incomingMessage)) {
      const tReply = await getServerT(
        await resolveChatLocaleByPhone(fromNumber, effectiveClinicId),
        "whatsapp",
      );
      const handoverReply = tReply("autoReply.handoverSms");
      const updatedMessages: ChatMessage[] = [
        ...history,
        { role: "user", content: incomingMessage },
        { role: "assistant", content: handoverReply },
      ];
      await saveConversation(supabase, conversationKey, convId, updatedMessages, effectiveClinicId, "sms");
      await supabase
        .from("whatsapp_conversations")
        .update({ bot_disabled: true, ai_paused: true })
        .eq("phone", conversationKey)
        .then(() => {}, () => {});
      return new NextResponse(twimlMessage(handoverReply), {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Lead automático para número desconhecido (telefone real, sem prefixo)
    if (effectiveClinicId && !convId) {
      void autoCreateLeadFromChannel(supabase, {
        phone: fromNumber,
        clinicId: effectiveClinicId,
        firstMessage: incomingMessage,
        channelLabel: "SMS",
      });
    }

    // ── Prompt: persona/funil da clínica + regra do canal SMS ──────────────
    const step = funnelStepFromHistory(history.length, updatedAt);
    const bookingUrl = buildBookingUrl(botConfig?.clinic_slug);
    const systemPrompt =
      buildSystemPrompt(botConfig ?? IFWC_DEFAULT_CONFIG, step) + buildSmsChannelRule(bookingUrl);

    // max_tokens menor que no WhatsApp: SMS pede respostas de até ~300 chars
    const reply = await generateReply(incomingMessage, history, systemPrompt, apiKey, { maxTokens: 220 });
    let finalReply = reply;
    if (!finalReply) {
      const tReply = await getServerT(
        await resolveChatLocaleByPhone(fromNumber, effectiveClinicId),
        "whatsapp",
      );
      finalReply = tReply("autoReply.fallbackSms");
    }

    // BUG-02: await the save so history is persisted before next message arrives
    const updatedMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: incomingMessage },
      { role: "assistant", content: finalReply },
    ];
    await saveConversation(supabase, conversationKey, convId, updatedMessages, effectiveClinicId, "sms");

    // Resposta via TwiML, como no WhatsApp Twilio
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
