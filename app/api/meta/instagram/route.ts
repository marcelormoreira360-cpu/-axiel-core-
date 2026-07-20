import crypto from "crypto";
import { openaiChatCompletion } from "@/lib/openai-chat-fetch";
import { chatModel } from "@/lib/ai-models";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG, getWhatsAppBotConfigByInstagramId, getWhatsAppBotConfigByClinicId, META_LANG_RULE, META_BEHAVIOR_RULE, META_EMERGENCY_RULE, detectMetaLanguage, metaLangToConfigLanguage, metaLangToLocale, funnelStepFromHistory } from "@/services/whatsapp-bot-service";
import { detectLanguage } from "@/lib/whatsapp-lang";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { shouldSilenceAi } from "@/lib/whatsapp-handoff";
import { isDuplicateMetaMessage } from "@/lib/meta-dedup";
import { isOptOutRequest } from "@/lib/whatsapp-optout";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import { createLogger } from "@/lib/logger";
import { sendInstagramText } from "@/lib/instagram-api";
import { parseImageMarker } from "@/lib/image-marker";
import { enqueueOutboundMedia } from "@/services/outbound-media-service";

export const runtime = "nodejs";
// > que o AbortSignal de 15s das chamadas OpenAI (fallback gracioso antes do teto).
export const maxDuration = 20;

const log = createLogger("instagram");

// Envio de imagem no DM (item 6 Fase 1). DORMENTE por padrão: só ativa com
// META_IG_IMAGE_ENABLED=true. Requer o cron do worker de mídia rodando em
// frequência alta (plano Pro) para a imagem não chegar com atraso do cron.
const IG_IMAGE_ENABLED = process.env.META_IG_IMAGE_ENABLED === "true";

// Regra injetada no prompt só quando habilitado: a Clara pode pedir UMA imagem.
const IG_IMAGE_RULE =
  "\n\nIMAGEM (opcional): quando fizer sentido mostrar um visual de apoio (ex.: um cartão de boas-vindas), inclua no FINAL da resposta, no máximo uma vez, o marcador [[IMG: descrição objetiva da imagem]]. Use com parcimônia. NUNCA para conteúdo clínico, diagnóstico, resultado de exame ou promessa de cura. O marcador é removido antes de enviar ao paciente.";

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

const IFWC_CLINIC_ID = "98e98ef3-a056-40bd-989b-0ab69d0c4bff";

// Contas de Instagram EXTRAS (ex.: conta pessoal do profissional) que atendem
// pela mesma clínica, mas não têm linha própria em whatsapp_bot_configs (a coluna
// clinic_id é única, então não cabe uma 2ª config para a mesma clínica). Mapeia
// o id da conta IG → clinic_id. Configurável por env "META_IG_EXTRA_ACCOUNTS"
// no formato "<igId>:<clinicId>,<igId>:<clinicId>". Mantém a regra SEC-01: só
// contas conhecidas (com config no banco OU neste mapa) são atendidas.
function extraIgAccounts(): Record<string, string> {
  const raw = process.env.META_IG_EXTRA_ACCOUNTS;
  if (raw) {
    const map: Record<string, string> = {};
    for (const pair of raw.split(",")) {
      const [ig, clinic] = pair.split(":").map((s) => s.trim());
      if (ig && clinic) map[ig] = clinic;
    }
    return map;
  }
  // Default: conta pessoal de Instagram do Marcelo (@marcelomoreira360) → IFWC.
  return { "17841400592744534": IFWC_CLINIC_ID };
}

// A Meta pode assinar os webhooks do Instagram com o app secret do INSTAGRAM
// (Instagram business login) OU com o app secret do Facebook, dependendo do
// evento. Aceita a assinatura se bater com QUALQUER um dos dois.
function isValidInstagramSignature(signature: string | null, body: Buffer): boolean {
  if (!signature) return false;
  const [algo, hash] = signature.split("=");
  if (algo !== "sha256" || !hash) return false;
  const secrets = [process.env.META_INSTAGRAM_APP_SECRET, process.env.META_APP_SECRET]
    .filter((s): s is string => !!s);
  return secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getHistory(
  supabase: SupabaseAdmin,
  userId: string
): Promise<{ id: string | null; messages: ChatMessage[]; botDisabled: boolean; aiPaused: boolean; lastHumanMessageAt: string | null; updatedAt: string | null }> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("id, messages, bot_disabled, ai_paused, last_human_message_at, updated_at")
      .eq("phone", `ig_${userId}`)
      .maybeSingle();
    return {
      id: data?.id ?? null,
      messages: (data?.messages as ChatMessage[]) ?? [],
      botDisabled: data?.bot_disabled ?? false,
      aiPaused: data?.ai_paused ?? false,
      lastHumanMessageAt: data?.last_human_message_at ?? null,
      updatedAt: data?.updated_at ?? null,
    };
  } catch {
    return { id: null, messages: [], botDisabled: false, aiPaused: false, lastHumanMessageAt: null, updatedAt: null };
  }
}

// Humano respondeu pela caixa de entrada do Instagram (fora do Core): registra
// a mensagem e abre a janela de atendimento humano (IA pausa por 24h — mesma
// regra de quando a equipe responde pela tela do Core).
async function registerHumanReply(
  supabase: SupabaseAdmin,
  userId: string,
  text: string,
  clinicId: string,
) {
  try {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("messages")
      .eq("phone", `ig_${userId}`)
      .maybeSingle();
    const history = ((data?.messages as ChatMessage[]) ?? []);
    const messages = text ? [...history, { role: "assistant" as const, content: text }].slice(-20) : history;
    await supabase.from("whatsapp_conversations").upsert(
      { phone: `ig_${userId}`, clinic_id: clinicId, messages, last_human_message_at: now, updated_at: now },
      { onConflict: "phone" },
    );
  } catch (e) {
    log.error("registerHumanReply failed", e, { conversation: `ig_${userId.slice(-4)}` });
  }
}

async function saveHistory(
  supabase: SupabaseAdmin,
  userId: string,
  id: string | null,
  messages: ChatMessage[],
  clinicId?: string | null
) {
  const payload: Record<string, unknown> = {
    phone: `ig_${userId}`,
    messages: messages.slice(-20),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      await supabase.from("whatsapp_conversations").update(payload).eq("id", id);
    } else {
      // New row — clinic_id is required (NOT NULL). UPSERT on phone is safe
      // against concurrent first messages from the same IG user.
      if (clinicId) payload.clinic_id = clinicId;
      await supabase.from("whatsapp_conversations").upsert(payload, { onConflict: "phone" });
    }
  } catch { /* non-blocking */ }
}

// Cria lead no CRM quando um usuário novo do Instagram inicia conversa (não bloqueia o bot)
async function autoCreateLead(
  supabase: SupabaseAdmin,
  userId: string,
  clinicId: string,
  firstMessage: string
) {
  try {
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("phone", `ig_${userId}`);
    if ((count ?? 0) > 0) return; // já existe

    await supabase.from("leads").insert({
      clinic_id: clinicId,
      full_name: `Instagram ${userId.slice(-4)}`,
      phone: `ig_${userId}`,
      source: "other",
      stage: "new_lead",
      notes: `Lead criado automaticamente via Instagram DM.\nPrimeira mensagem: "${firstMessage.slice(0, 200)}"`,
    });
  } catch (e) {
    log.error("auto-create lead failed", e);
  }
}

// ─── Send reply via Instagram Graph API ──────────────────────────────────────

// Envio de texto/imagem extraido para lib/instagram-api (reusado pelo worker de
// midia). Token por conta: META_INSTAGRAM_TOKEN_<igAccountId>, com fallback global.

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

// ─── Opt-out / human escalation detection ────────────────────────────────────
// Meta App Review requires that users can easily opt out of automation and reach
// a person. Detecção compartilhada entre canais em lib/whatsapp-optout.ts.

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("Instagram webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — incoming Instagram DMs ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new NextResponse("", { status: 200 });

  try {
    // Bytes brutos para validar a assinatura (re-codificar o texto quebra o HMAC
    // quando a mensagem tem acento/emoji, ex.: "Olá").
    const rawBuffer = Buffer.from(await req.arrayBuffer());

    if (!isValidInstagramSignature(req.headers.get("x-hub-signature-256"), rawBuffer)) {
      console.warn("Instagram webhook: invalid signature");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = JSON.parse(rawBuffer.toString("utf-8"));
    if (body.object !== "instagram") return new NextResponse("", { status: 200 });

    const supabase = createSupabaseAdminClient();

    for (const entry of body.entry ?? []) {
      // SEC-01: resolve the clinic from the Instagram account id (entry.id).
      // No fallback to a hardcoded config — if no clinic has this IG id
      // configured, skip the entry silently (never leak another clinic's data).
      const igAccountId: string = entry.id ?? "";
      if (!igAccountId) continue;

      const dbConfig = await getWhatsAppBotConfigByInstagramId(igAccountId).catch(() => null);
      let clinicId: string;
      if (dbConfig) {
        clinicId = dbConfig.clinic_id;
      } else {
        // Conta sem config própria no banco: atende só se for uma conta EXTRA
        // conhecida (ex.: a conta pessoal do profissional). Senão ignora (SEC-01).
        const extraClinic = extraIgAccounts()[igAccountId];
        if (!extraClinic) continue;
        clinicId = extraClinic;
      }
      // Persona do prompt: a config da conta, senão a config da CLÍNICA (conta
      // extra, ex.: IG pessoal — antes caía na config de fábrica e perdia as
      // custom_instructions da Clara), senão a padrão IFWC.
      // SEC-01: só cai no IFWC_DEFAULT_CONFIG se a clínica resolvida FOR a IFWC.
      // Uma clínica sem config própria não pode falar com a identidade da IFWC.
      const promptConfig =
        dbConfig ??
        (await getWhatsAppBotConfigByClinicId(clinicId).catch(() => null)) ??
        (clinicId === IFWC_CLINIC_ID ? IFWC_DEFAULT_CONFIG : null);
      if (!promptConfig) continue;

      for (const event of entry.messaging ?? []) {
        // Dedup (PRIMEIRA checagem): a Meta reenvia o webhook quando não recebe
        // 200 rápido (o LLM demora), e cada reenvio do MESMO evento gerava uma
        // nova resposta do bot. Se o mid já foi processado, é retry — pula.
        // Mensagens sem mid seguem o fluxo normal.
        const mid: string | undefined = event.message?.mid;
        if (await isDuplicateMetaMessage(supabase, mid)) continue;

        // Echo = mensagem enviada PELA conta (is_echo nem sempre vem no
        // Instagram, então também detectamos por sender.id == igAccountId).
        // Se o texto for uma resposta recente do próprio bot, é o eco da nossa
        // Graph API — ignora (senão vira loop). Qualquer outro texto foi um
        // HUMANO respondendo pelo app do Instagram → pausa a IA por 24h.
        if (event.message?.is_echo || (event.sender?.id && event.sender.id === igAccountId)) {
          const echoText: string = event.message?.text?.trim() ?? "";
          const echoUserId: string | undefined = event.recipient?.id;
          if (!echoUserId || echoUserId === igAccountId) continue;
          const { messages: echoHistory } = await getHistory(supabase, echoUserId);
          const recentBotReplies = echoHistory
            .filter((m) => m.role === "assistant")
            .slice(-3)
            .map((m) => m.content.trim());
          if (echoText && recentBotReplies.includes(echoText)) continue; // eco do próprio bot
          await registerHumanReply(supabase, echoUserId, echoText, clinicId);
          continue;
        }

        const senderId: string = event.sender?.id;
        const messageText: string = event.message?.text?.trim() ?? "";

        if (!senderId || !messageText) continue;

        // Disjuntor anti-loop: se uma conversa dispara muitas mensagens num minuto
        // (ex.: duas contas com bot conversando entre si, ou eco), desativa o bot
        // nessa conversa para parar o loop. Em uso normal, um lead não atinge isso.
        if (!(await checkRateLimitDb(`ig:${senderId}`, 5, 60_000))) {
          console.warn(`[instagram] possível loop em ${senderId} — desativando bot na conversa`);
          await supabase
            .from("whatsapp_conversations")
            .update({ bot_disabled: true })
            .eq("phone", `ig_${senderId}`)
            .then(() => {}, () => {});
          continue;
        }

        const { id: convId, messages: history, botDisabled, aiPaused, lastHumanMessageAt, updatedAt } =
          await getHistory(supabase, senderId);

        // Anti-eco: se a mensagem que chega é idêntica à última resposta do próprio
        // bot, é o echo voltando — ignora.
        const lastBotReply = [...history].reverse().find((m) => m.role === "assistant")?.content;
        if (lastBotReply && messageText === lastBotReply) continue;

        // Passagem de bastão: IA pausada ou humano respondeu há menos de 24h.
        // Salva a mensagem e não responde.
        if (shouldSilenceAi({ aiPaused, botDisabled, lastHumanMessageAt })) {
          await saveHistory(supabase, senderId, convId, [
            ...history,
            { role: "user", content: messageText },
          ], clinicId);
          continue;
        }

        // Opt-out / human escalation (Meta App Review requirement): the patient
        // can ask to talk to a person. We reply once, flag the conversation for a
        // human to take over (bot_disabled), and stop auto-replying in this thread.
        if (isOptOutRequest(messageText)) {
          // Responde no idioma do LEAD (detectado da mensagem), não no da clínica.
          const optOutLang = detectMetaLanguage(detectLanguage(history, messageText), history, messageText, (t) => detectLanguage([], t));
          const replyLocale = metaLangToLocale(optOutLang, await resolveClinicLocale(clinicId));
          const tReply = await getServerT(replyLocale, "whatsapp");
          const handover = tReply("autoReply.handover");
          await saveHistory(supabase, senderId, convId, [
            ...history,
            { role: "user", content: messageText },
            { role: "assistant", content: handover },
          ], clinicId);
          await supabase
            .from("whatsapp_conversations")
            .update({ bot_disabled: true, ai_paused: true })
            .eq("phone", `ig_${senderId}`)
            .then(() => {}, () => {});
          await sendInstagramText(senderId, handover, igAccountId);
          continue;
        }

        // Primeira mensagem de um usuário novo → cria lead no CRM
        if (!convId) {
          void autoCreateLead(supabase, senderId, clinicId, messageText);
        }

        // Passo do funil estimado pelo histórico + regra de idioma (PT/EN/ES);
        // conversa parada há 48h+ volta ao acolhimento em vez de cair no passo 7.
        const step = funnelStepFromHistory(history.length, updatedAt);

        // Idioma DETERMINÍSTICO por código (PT/EN base + passe de ES), como no
        // Meta WhatsApp: mapeia p/ o campo `language` do config para que o
        // langNote E os templates saiam no idioma certo.
        const metaLang = detectMetaLanguage(detectLanguage(history, messageText), history, messageText, (t) => detectLanguage([], t));
        const langConfig = { ...promptConfig, language: metaLangToConfigLanguage(metaLang, promptConfig.language) };
        const systemPrompt =
          buildSystemPrompt(langConfig, step) + META_LANG_RULE + META_BEHAVIOR_RULE + META_EMERGENCY_RULE +
          (IG_IMAGE_ENABLED ? IG_IMAGE_RULE : "");

        const reply = await generateReply(messageText, history, systemPrompt, apiKey);
        let finalReply = reply;
        if (!finalReply) {
          const tReply = await getServerT(metaLangToLocale(metaLang, await resolveClinicLocale(clinicId)), "whatsapp");
          finalReply = tReply("autoReply.fallback");
        }

        // Marcador de imagem: quando habilitado, separa o texto do prompt de
        // imagem. Sem o flag, envia o texto como está (nunca vaza o marcador).
        const parsed = IG_IMAGE_ENABLED ? parseImageMarker(finalReply) : { text: finalReply, prompt: null };
        const textOut = parsed.text.trim();
        const willSendImage = IG_IMAGE_ENABLED && !!parsed.prompt;
        const replyText = textOut || (willSendImage ? "" : finalReply);

        await saveHistory(supabase, senderId, convId, [
          ...history,
          { role: "user", content: messageText },
          { role: "assistant", content: replyText || "[imagem]" },
        ], clinicId);

        if (replyText) await sendInstagramText(senderId, replyText, igAccountId);
        if (willSendImage) {
          await enqueueOutboundMedia({
            clinicId,
            channel: "instagram",
            recipientId: senderId,
            igAccountId,
            conversationKey: `ig_${senderId}`,
            generatePrompt: parsed.prompt,
          }).catch((e) => log.error("enqueue image failed", e));
        }
      }
    }

    return new NextResponse("", { status: 200 });
  } catch (err) {
    log.error("webhook error", err);
    return new NextResponse("", { status: 200 });
  }
}
