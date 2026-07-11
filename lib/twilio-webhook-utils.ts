// Helpers puros dos webhooks Twilio (WhatsApp e SMS).
//
// Extraídos de app/api/whatsapp/webhook/route.ts para serem reutilizados pelo
// canal de SMS (app/api/sms/webhook/route.ts) e testados sem Next.js/Supabase.

// ─── Parse do corpo x-www-form-urlencoded do Twilio ──────────────────────────

export function parseTwilioParams(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  new URLSearchParams(rawBody).forEach((v, k) => {
    params[k] = v;
  });
  return params;
}

// ─── Resposta TwiML ──────────────────────────────────────────────────────────

/** Monta <Response><Message>...</Message></Response> com escape de XML. */
export function twimlMessage(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

// ─── Canal por prefixo do campo phone ────────────────────────────────────────
// whatsapp_conversations.phone identifica o canal pelo prefixo:
//   sem prefixo = WhatsApp (Twilio/Meta) · fb_ = Messenger · ig_ = Instagram ·
//   sms_ = SMS (Twilio). O prefixo evita colisão entre o WhatsApp e o SMS do
//   MESMO número de telefone.

export const SMS_PHONE_PREFIX = "sms_";

export type ConversationChannel = "whatsapp" | "messenger" | "instagram" | "sms";

export function conversationChannel(phone: string): ConversationChannel {
  if (phone.startsWith(SMS_PHONE_PREFIX)) return "sms";
  if (phone.startsWith("fb_")) return "messenger";
  if (phone.startsWith("ig_")) return "instagram";
  return "whatsapp";
}

/** Chave da conversa de SMS em whatsapp_conversations (ex.: sms_+14075551234). */
export function smsConversationKey(phone: string): string {
  return `${SMS_PHONE_PREFIX}${phone}`;
}

// ─── Regra de canal para o system prompt do SMS ──────────────────────────────
// SMS é curto e sem formatação: instrui o modelo a responder em até ~300
// caracteres, sem emoji, e a oferecer o link público de agendamento quando o
// lead quiser marcar (paridade com o passo 7 do funil do WhatsApp).

// ─── SEC-01 (multi-tenant): a quem pertence este número Twilio ───────────────
// Os canais Twilio (WhatsApp/SMS/Voz) resolvem a config da clínica pelo número
// de DESTINO (getWhatsAppBotConfigByNumber). Quando nenhuma clínica tem esse
// número configurado, NÃO se pode responder com a identidade/preços da IFWC
// (vazamento cross-tenant): a config de fábrica IFWC só vale para o próprio
// número da IFWC (env TWILIO_FROM_NUMBER).

/** Remove o prefixo "whatsapp:" e espaços de um número, para comparação. */
export function normalizePhone(n: string | null | undefined): string {
  return (n ?? "").replace("whatsapp:", "").trim();
}

/**
 * true quando o número de destino é o número próprio da IFWC (env
 * TWILIO_FROM_NUMBER). Só nesse caso é seguro cair no IFWC_DEFAULT_CONFIG.
 * Se o env não estiver definido, retorna true para preservar o comportamento
 * atual e nunca quebrar o ambiente por falta de config.
 */
export function isIfwcOwnNumber(toNumber: string | null | undefined): boolean {
  const own = normalizePhone(process.env.TWILIO_FROM_NUMBER);
  if (!own) return true;
  return normalizePhone(toNumber) === own;
}

export function buildSmsChannelRule(bookingUrl: string): string {
  return (
    `\n\n━━━ CANAL: SMS (OBRIGATÓRIO) ━━━\n` +
    `Esta conversa acontece por SMS (mensagem de texto), não por WhatsApp.\n` +
    `• Responda em NO MÁXIMO 300 caracteres por mensagem.\n` +
    `• NÃO use emojis, negrito, asteriscos nem listas longas.\n` +
    `• Não use o travessão "—"; prefira vírgula ou dois-pontos.\n` +
    `• Seja direto e caloroso: uma ideia e uma pergunta por mensagem.\n` +
    `• Quando o lead quiser agendar (ou no fechamento), ofereça o link de agendamento: ${bookingUrl}`
  );
}
