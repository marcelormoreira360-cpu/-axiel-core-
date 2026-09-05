/**
 * Envio de resposta manual do inbox, roteado pelo canal da conversa.
 *
 * O campo `whatsapp_conversations.phone` identifica o canal pelo prefixo
 * (lib/twilio-webhook-utils): WhatsApp (sem prefixo), ig_ = Instagram,
 * fb_ = Messenger, sms_ = SMS. Cada canal tem uma API própria:
 *   - WhatsApp  → Twilio (texto e qualquer mídia)
 *   - Instagram → graph.instagram.com (texto e IMAGEM)
 *   - Messenger → graph.facebook.com (texto e IMAGEM)
 * Os IDs de conta/página vêm da config do bot da clínica (whatsapp_bot_configs).
 */

import { conversationChannel } from "@/lib/twilio-webhook-utils";
import { sendWhatsAppText, sendWhatsAppMedia } from "@/services/whatsapp-service";
import { sendInstagramText, sendInstagramImage } from "@/lib/instagram-api";
import { sendMessengerText, sendMessengerImage } from "@/lib/messenger-api";
import { getWhatsAppBotConfigByClinicId } from "@/services/whatsapp-bot-service";
import { createLogger } from "@/lib/logger";
import type { WaMediaKind } from "@/services/whatsapp-conversation-service";

const log = createLogger("inbox-send");

export type InboxTarget = { phone: string; clinicId: string | null };

/** Remove o prefixo de canal, deixando o id/telefone do destinatário. */
function recipientId(phone: string): string {
  if (phone.startsWith("ig_") || phone.startsWith("fb_")) return phone.slice(3);
  if (phone.startsWith("sms_")) return phone.slice(4);
  return phone;
}

/** IDs Meta (Instagram / página do Facebook) da clínica. */
async function metaIds(clinicId: string | null): Promise<{ ig: string | null; page: string | null }> {
  if (!clinicId) return { ig: null, page: null };
  const cfg = await getWhatsAppBotConfigByClinicId(clinicId).catch(() => null);
  return { ig: cfg?.meta_instagram_id ?? null, page: cfg?.meta_facebook_page_id ?? null };
}

/** Canais em que dá para anexar imagem pela resposta manual. */
export function channelSupportsImage(phone: string): boolean {
  const c = conversationChannel(phone);
  return c === "whatsapp" || c === "instagram" || c === "messenger";
}

/** Envia texto pelo canal certo. Lança erro claro se faltar config do canal. */
export async function sendInboxText(target: InboxTarget, text: string): Promise<void> {
  const channel = conversationChannel(target.phone);
  const to = recipientId(target.phone);

  if (channel === "whatsapp") return void (await sendWhatsAppText(target.phone, text));
  if (channel === "sms") throw new Error("Resposta manual por SMS ainda não é suportada.");

  const { ig, page } = await metaIds(target.clinicId);
  if (channel === "instagram") {
    if (!ig) throw new Error("Instagram não configurado para esta clínica.");
    return void (await sendInstagramText(to, text, ig));
  }
  // messenger
  if (!page) throw new Error("Messenger não configurado para esta clínica.");
  return void (await sendMessengerText(to, text, page));
}

/**
 * Envia mídia pelo canal certo. WhatsApp aceita qualquer mídia; Instagram e
 * Messenger só imagem (a legenda vai como texto separado, limitação da Meta).
 * `publicUrl` precisa ser acessível pela operadora/Meta (URL assinada curta).
 */
export async function sendInboxMedia(
  target: InboxTarget,
  kind: WaMediaKind,
  publicUrl: string,
  caption: string,
): Promise<void> {
  const channel = conversationChannel(target.phone);
  const to = recipientId(target.phone);

  if (channel === "whatsapp") return void (await sendWhatsAppMedia(target.phone, caption, publicUrl));

  if (kind !== "image") {
    throw new Error("Neste canal só é possível enviar imagem.");
  }

  const { ig, page } = await metaIds(target.clinicId);
  if (channel === "instagram") {
    if (!ig) throw new Error("Instagram não configurado para esta clínica.");
    await sendInstagramImage(to, publicUrl, ig);
    // Legenda é best-effort: a imagem já foi entregue, então uma falha aqui não
    // pode desfazer o registro nem provocar reenvio (que duplicaria a imagem).
    if (caption) await sendInstagramText(to, caption, ig).catch((e) => log.warn("caption IG falhou", { e: String(e) }));
    return;
  }
  if (channel === "messenger") {
    if (!page) throw new Error("Messenger não configurado para esta clínica.");
    await sendMessengerImage(to, publicUrl, page);
    if (caption) await sendMessengerText(to, caption, page).catch((e) => log.warn("caption Messenger falhou", { e: String(e) }));
    return;
  }
  throw new Error("Este canal não suporta anexo.");
}
