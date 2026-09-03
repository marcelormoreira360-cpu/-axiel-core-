/**
 * Envio pela API de mensagens do Messenger (Facebook Page).
 *
 * Usa graph.facebook.com/me/messages com o Page Access Token. Mesmo padrão de
 * token do webhook (app/api/meta/facebook/route.ts) e de lib/meta-channel-status:
 * META_FACEBOOK_TOKEN_<pageId> com fallback global META_FACEBOOK_PAGE_TOKEN.
 *
 * Compartilhado pela resposta manual do inbox (services/inbox-send-service).
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("messenger-api");
const FB_MESSAGES_URL = "https://graph.facebook.com/v20.0/me/messages";

/** Page Access Token (por página, com fallback global) — multi-clínica. */
export function getMessengerToken(pageId: string): string {
  const token =
    process.env[`META_FACEBOOK_TOKEN_${pageId}`] || process.env.META_FACEBOOK_PAGE_TOKEN;
  if (!token) throw new Error(`No Facebook token for page ${pageId}`);
  return token;
}

async function sendMessengerMessage(
  recipientPsid: string,
  message: Record<string, unknown>,
  pageId: string,
): Promise<void> {
  const token = getMessengerToken(pageId);
  const res = await fetch(FB_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message,
      messaging_type: "RESPONSE",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    log.error("send error", { detail: JSON.stringify(err) });
    throw new Error(`Facebook API error: ${res.status}`);
  }
}

/** Resposta de texto no Messenger. */
export function sendMessengerText(recipientPsid: string, text: string, pageId: string): Promise<void> {
  return sendMessengerMessage(recipientPsid, { text }, pageId);
}

/**
 * Imagem no Messenger. A Meta busca a `imageUrl` (precisa ser publicamente
 * acessível, ex.: URL assinada do Storage). A legenda vai como texto separado.
 */
export function sendMessengerImage(recipientPsid: string, imageUrl: string, pageId: string): Promise<void> {
  return sendMessengerMessage(
    recipientPsid,
    { attachment: { type: "image", payload: { url: imageUrl } } },
    pageId,
  );
}
