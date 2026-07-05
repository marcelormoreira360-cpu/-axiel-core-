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
