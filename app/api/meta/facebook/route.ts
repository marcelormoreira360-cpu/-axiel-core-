import { NextRequest, NextResponse } from "next/server";
import { openaiChatCompletion } from "@/lib/openai-chat-fetch";
import { chatModel } from "@/lib/ai-models";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature } from "@/lib/webhook-guard";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG, META_LANG_RULE, META_BEHAVIOR_RULE, META_EMERGENCY_RULE, detectMetaLanguage, metaLangToConfigLanguage, metaLangToLocale, funnelStepFromHistory, getWhatsAppBotConfigByClinicId, getWhatsAppBotConfigByFacebookPageId } from "@/services/whatsapp-bot-service";
import { detectLanguage } from "@/lib/whatsapp-lang";
import { shouldSilenceAi } from "@/lib/whatsapp-handoff";
import { isDuplicateMetaMessage } from "@/lib/meta-dedup";
import { isOptOutRequest } from "@/lib/whatsapp-optout";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
// > que o AbortSignal de 15s das chamadas OpenAI (fallback gracioso antes do teto).
export const maxDuration = 20;

const log = createLogger("messenger");

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

// Clínica atendida por este webhook (IFWC). Configurável por env; fallback fixo.
const IFWC_CLINIC_ID =
  process.env.META_BOT_CLINIC_ID ?? "98e98ef3-a056-40bd-989b-0ab69d0c4bff";

// Id do app Meta (AXIEL Core). Echoes com este app_id são as mensagens que o
// próprio bot enviou pela Graph API; echoes de outro app (ou sem app_id) são
// um HUMANO respondendo pela caixa de entrada do Messenger/Business Suite.
const META_APP_ID = process.env.META_APP_ID ?? "1468755454577652";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHistory(
  supabase: SupabaseAdmin,
  psid: string
): Promise<{ id: string | null; messages: ChatMessage[]; botDisabled: boolean; aiPaused: boolean; lastHumanMessageAt: string | null; clinicId: string | null; updatedAt: string | null }> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled, ai_paused, last_human_message_at, clinic_id, updated_at")
      .eq("phone", `fb_${psid}`)
      .maybeSingle();
    return {
      id: data?.id ?? null,
      messages: (data?.messages as ChatMessage[]) ?? [],
      botDisabled: data?.bot_disabled ?? false,
      aiPaused: data?.ai_paused ?? false,
      lastHumanMessageAt: data?.last_human_message_at ?? null,
      clinicId: data?.clinic_id ?? null,
      updatedAt: data?.updated_at ?? null,
    };
  } catch {
    return { id: null, messages: [], botDisabled: false, aiPaused: false, lastHumanMessageAt: null, clinicId: null, updatedAt: null };
  }
}

// Humano respondeu pela caixa de entrada do Messenger (fora do Core): registra
// a mensagem no histórico e abre a janela de atendimento humano (a IA pausa por
// 24h — mesma regra de quando a equipe responde pela tela do Core).
async function registerHumanReply(
  supabase: SupabaseAdmin,
  conversationKey: string,
  text: string,
  clinicId: string,
) {
  try {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages")
      .eq("phone", conversationKey)
      .maybeSingle();
    const history = ((data?.messages as ChatMessage[]) ?? []);
    const messages = text ? [...history, { role: "assistant" as const, content: text }].slice(-20) : history;
    await supabase.from("whatsapp_conversations").upsert(
      { phone: conversationKey, clinic_id: clinicId, messages, last_human_message_at: now, updated_at: now },
      { onConflict: "phone" },
    );
  } catch (e) {
    log.error("registerHumanReply failed", e, { conversation: conversationKey });
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
      if (error) log.error("saveHistory UPDATE error", { error: error.message });
    } else {
      // clinic_id é NOT NULL na tabela — sem ele o insert falha silenciosamente
      if (clinicId) payload.clinic_id = clinicId;
      const { error } = await supabase
        .from("whatsapp_conversations")
        .upsert(payload, { onConflict: "phone" });
      if (error) log.error("saveHistory UPSERT error", { error: error.message });
    }
  } catch (e) {
    log.error("saveHistory exception", e);
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
    log.error("auto-create lead failed", e);
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
    log.error("send error", { detail: JSON.stringify(err) });
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
  try {
    const res = await openaiChatCompletion(apiKey, {
      model: chatModel(),
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-12),
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 450,
    });

    const data = await res.json();
    if (!res.ok) {
      log.error("OpenAI error", { status: res.status, detail: JSON.stringify(data) });
      return "";
    }
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    // Timeout (AbortSignal) ou falha de rede → resposta vazia (o chamador usa fallback).
    log.error("OpenAI request failed or timed out", err);
    return "";
  }
}

// ─── Opt-out / human escalation (exigência do App Review) ────────────────────
// Detecção compartilhada entre canais em lib/whatsapp-optout.ts.

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

      // SEC-01 (Facebook): resolve a clínica pela PÁGINA. Se a página estiver
      // registrada por uma clínica, o bot usa a identidade/config dela (fim do
      // vazamento cross-tenant). Páginas ainda não registradas mantêm a IFWC
      // (compat single-tenant atual, até a clínica cadastrar a página nas settings).
      const pageConfig = await getWhatsAppBotConfigByFacebookPageId(pageId).catch(() => null);
      const pageClinicId = pageConfig?.clinic_id ?? null;

      for (const event of entry.messaging ?? []) {
        // Dedup (PRIMEIRA checagem): a Meta reenvia o webhook quando não recebe
        // 200 rápido (o LLM demora), e cada reenvio do MESMO evento gerava uma
        // nova resposta do bot. Se o mid já foi processado, é retry — pula.
        // Mensagens sem mid seguem o fluxo normal.
        const mid: string | undefined = event.message?.mid;
        if (await isDuplicateMetaMessage(supabase, mid)) continue;

        // Echo = mensagem enviada PELA página. Se veio do nosso app, é o próprio
        // bot (ignora). Senão, foi um humano respondendo pelo app do Messenger/
        // Business Suite → pausa a IA nesta conversa (janela de 24h).
        if (event.message?.is_echo) {
          const echoAppId = event.message?.app_id != null ? String(event.message.app_id) : null;
          if (echoAppId === META_APP_ID) continue;
          const userPsid: string | undefined = event.recipient?.id;
          if (userPsid) {
            await registerHumanReply(
              supabase,
              `fb_${userPsid}`,
              event.message?.text?.trim() ?? "",
              pageClinicId ?? IFWC_CLINIC_ID,
            );
          }
          continue;
        }
        if (!event.message) continue;

        const senderPsid: string = event.sender?.id;
        const messageText: string = event.message?.text?.trim() ?? "";

        if (!senderPsid || !messageText) continue;

        const { id: convId, messages: history, botDisabled, aiPaused, lastHumanMessageAt, clinicId: convClinicId, updatedAt } =
          await getHistory(supabase, senderPsid);
        const effectiveClinicId = pageClinicId ?? convClinicId ?? IFWC_CLINIC_ID;

        // Passagem de bastão: IA pausada ou humano respondeu há menos de 24h.
        // Salva a mensagem e não responde.
        if (shouldSilenceAi({ aiPaused, botDisabled, lastHumanMessageAt })) {
          await saveHistory(supabase, senderPsid, convId, [
            ...history,
            { role: "user", content: messageText },
          ], effectiveClinicId);
          continue;
        }

        // Opt-out / escalonamento humano: responde uma vez, marca a conversa
        // para um humano assumir (bot_disabled) e para de auto-responder.
        if (isOptOutRequest(messageText)) {
          // Responde no idioma do LEAD (detectado da mensagem), não no da clínica:
          // quem escreve em inglês recebe o opt-out em inglês.
          const optOutLang = detectMetaLanguage(detectLanguage(history, messageText), history, messageText);
          const replyLocale = metaLangToLocale(optOutLang, await resolveClinicLocale(effectiveClinicId));
          const tReply = await getServerT(replyLocale, "whatsapp");
          const handover = tReply("autoReply.handover");
          await saveHistory(supabase, senderPsid, convId, [
            ...history,
            { role: "user", content: messageText },
            { role: "assistant", content: handover },
          ], effectiveClinicId);
          await supabase
            .from("whatsapp_conversations")
            .update({ bot_disabled: true, ai_paused: true })
            .eq("phone", `fb_${senderPsid}`)
            .then(() => {}, () => {});
          await sendFacebookReply(senderPsid, handover, pageId);
          continue;
        }

        // Primeira mensagem de um PSID novo → cria lead no CRM
        if (!convId) {
          void autoCreateLead(supabase, senderPsid, effectiveClinicId, messageText);
        }

        // Passo do funil estimado pelo histórico (sai do "preso no passo 1");
        // conversa parada há 48h+ volta ao acolhimento em vez de cair no passo 7.
        const step = funnelStepFromHistory(history.length, updatedAt);

        // Config real da clínica (persona Clara nas custom_instructions, preços,
        // idioma). Prioriza a config da PÁGINA; senão a config da clínica resolvida;
        // e só cai no IFWC_DEFAULT_CONFIG se a clínica for a própria IFWC (SEC-01).
        const promptConfig =
          pageConfig ??
          (await getWhatsAppBotConfigByClinicId(effectiveClinicId).catch(() => null)) ??
          (effectiveClinicId === IFWC_CLINIC_ID ? IFWC_DEFAULT_CONFIG : null);
        if (!promptConfig) continue;

        // Idioma DETERMINÍSTICO por código (PT/EN base + passe de ES), como no
        // Meta WhatsApp: não confiar só no LLM. Mapeia p/ o campo `language` do
        // config para que o langNote E os templates saiam no idioma certo.
        const metaLang = detectMetaLanguage(detectLanguage(history, messageText), history, messageText);
        const langConfig = { ...promptConfig, language: metaLangToConfigLanguage(metaLang, promptConfig.language) };
        const systemPrompt = buildSystemPrompt(langConfig, step) + META_LANG_RULE + META_BEHAVIOR_RULE + META_EMERGENCY_RULE;

        const reply = await generateReply(messageText, history, systemPrompt, apiKey);
        let finalReply = reply;
        if (!finalReply) {
          const tReply = await getServerT(metaLangToLocale(metaLang, await resolveClinicLocale(effectiveClinicId)), "whatsapp");
          finalReply = tReply("autoReply.fallback");
        }

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
    log.error("webhook error", err);
    return new NextResponse("", { status: 200 });
  }
}
