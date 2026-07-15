/**
 * Envio pela API de mensagens do Instagram (login proprio, instagram_business_*).
 *
 * Usa graph.instagram.com (NAO graph.facebook.com: o token do IG da
 * "Cannot parse access token" no host do FB). Compartilhado entre o webhook
 * (respostas de texto da Clara) e o worker de midia (envio de imagem em DM).
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("instagram-api");
const IG_MESSAGES_URL = "https://graph.instagram.com/v21.0/me/messages";

/** Token da conta IG (por conta, com fallback global) — multi-clinica. */
export function getInstagramToken(igAccountId: string): string {
  const token =
    process.env[`META_INSTAGRAM_TOKEN_${igAccountId}`] || process.env.META_INSTAGRAM_TOKEN;
  if (!token) throw new Error("META_INSTAGRAM_TOKEN not set");
  return token;
}

async function sendInstagramMessage(
  recipientId: string,
  message: Record<string, unknown>,
  igAccountId: string
): Promise<void> {
  const token = getInstagramToken(igAccountId);
  const res = await fetch(IG_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recipient: { id: recipientId }, message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    log.error("send error", { detail: JSON.stringify(err) });
    throw new Error(`Instagram API error: ${res.status}`);
  }
}

/** Resposta de texto no DM. */
export function sendInstagramText(
  recipientId: string,
  text: string,
  igAccountId: string
): Promise<void> {
  return sendInstagramMessage(recipientId, { text }, igAccountId);
}

/**
 * Imagem no DM. A API busca a `imageUrl` (precisa ser publicamente acessivel,
 * ex.: URL assinada do Storage). A legenda vai como uma mensagem de texto
 * separada, porque o attachment de imagem nao carrega caption no mesmo envio.
 */
export function sendInstagramImage(
  recipientId: string,
  imageUrl: string,
  igAccountId: string
): Promise<void> {
  return sendInstagramMessage(
    recipientId,
    { attachment: { type: "image", payload: { url: imageUrl } } },
    igAccountId
  );
}
