"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  pauseAi,
  resumeAi,
  linkEntityToConversation,
  mediaKindFromMime,
  WA_MEDIA_BUCKET,
  type WaMedia,
} from "@/services/whatsapp-conversation-service";
import { sendInboxText, sendInboxMedia, channelSupportsImage } from "@/services/inbox-send-service";
import { conversationChannel } from "@/lib/twilio-webhook-utils";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Limites de mídia por canal: WhatsApp 16 MB; Instagram/Messenger 8 MB (Meta).
const WA_MEDIA_MAX_BYTES = 16 * 1024 * 1024;
const META_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
const WA_MEDIA_SEND_TTL = 600; // 10 min — janela p/ a operadora (Twilio/Meta) buscar o anexo

type ConvRow = { id: string; clinic_id: string | null; messages: unknown };

// ── Passagem de bastão: pausar IA / devolver para a Clara ──────────────────

export async function pauseAiAction(conversationId: string): Promise<void> {
  const profile = await getCurrentUserProfile();
  const name = profile?.full_name ?? "Operador";
  await pauseAi(conversationId, name);
  revalidatePath("/whatsapp");
}

export async function resumeAiAction(conversationId: string): Promise<void> {
  await resumeAi(conversationId);
  revalidatePath("/whatsapp");
}

// ── Send manual reply ──────────────────────────────────────────────────────

export async function sendManualReplyAction(
  phone: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!message.trim()) return { ok: false, error: "Mensagem vazia." };
  try {
    const conv = await loadConvByPhone(phone);
    if (!conv) return { ok: false, error: "Conversa não encontrada." };
    await sendInboxText({ phone, clinicId: conv.clinic_id }, message.trim());
    await appendToConv(conv, `[MANUAL] ${message.trim()}`);
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao enviar." };
  }
}

// ── Send manual media (imagem / áudio / arquivo) ────────────────────────────
// Roteado por canal (services/inbox-send-service): WhatsApp aceita qualquer
// mídia; Instagram/Messenger só imagem. Sobe o anexo no bucket privado, gera
// URL assinada curta para a operadora (Twilio/Meta) buscar, envia e registra na
// conversa (guarda o path, não a URL).

export async function sendManualMediaAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const phone = String(formData.get("phone") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const file = formData.get("file");

  if (!phone) return { ok: false, error: "Conversa inválida." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Nenhum arquivo selecionado." };
  }
  if (!channelSupportsImage(phone)) {
    return { ok: false, error: "Anexo não disponível neste canal." };
  }

  const isWhatsapp = conversationChannel(phone) === "whatsapp";
  const kind = mediaKindFromMime(file.type);
  if (!isWhatsapp && kind !== "image") {
    return { ok: false, error: "Neste canal só é possível enviar imagem." };
  }

  const maxBytes = isWhatsapp ? WA_MEDIA_MAX_BYTES : META_MEDIA_MAX_BYTES;
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `Arquivo acima de ${mb} MB (limite do canal).` };
  }

  try {
    const conv = await loadConvByPhone(phone);
    if (!conv) return { ok: false, error: "Conversa não encontrada." };
    const clinicId = conv.clinic_id ?? "sem-clinica";
    const supabase = createSupabaseAdminClient();

    const ext = extensionFor(file);
    const path = `whatsapp-outbound/${clinicId}/${crypto.randomUUID()}${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(WA_MEDIA_BUCKET)
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) return { ok: false, error: `Falha ao subir anexo: ${upErr.message}` };

    const { data: signed, error: signErr } = await supabase.storage
      .from(WA_MEDIA_BUCKET)
      .createSignedUrl(path, WA_MEDIA_SEND_TTL);
    if (signErr || !signed?.signedUrl) {
      return { ok: false, error: "Falha ao preparar o anexo para envio." };
    }

    await sendInboxMedia({ phone, clinicId: conv.clinic_id }, kind, signed.signedUrl, caption);

    const media: WaMedia = { kind, path, name: file.name, mime: file.type || null };
    await appendToConv(conv, `[MANUAL] ${caption}`.trim(), media);

    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao enviar anexo." };
  }
}

/** Extensão a partir do nome do arquivo (com fallback pelo MIME de áudio gravado). */
function extensionFor(file: File): string {
  const fromName = file.name.match(/(\.[a-z0-9]{1,5})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (file.type.includes("mp4")) return ".m4a";
  if (file.type.includes("mpeg")) return ".mp3";
  if (file.type.includes("ogg")) return ".ogg";
  if (file.type.includes("webm")) return ".webm";
  return "";
}

/** Carrega a conversa pelo phone (id, clínica, mensagens) para enviar e registrar. */
async function loadConvByPhone(phone: string): Promise<ConvRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("id, clinic_id, messages")
    .eq("phone", phone)
    .maybeSingle();
  return (data as ConvRow | null) ?? null;
}

/**
 * Registra uma mensagem enviada pela equipe na conversa e abre a janela de
 * atendimento humano (silencia a Clara por 24h — lib/whatsapp-handoff).
 */
async function appendToConv(conv: ConvRow, content: string, media?: WaMedia): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const entry: { role: "assistant"; content: string; media?: WaMedia } = { role: "assistant", content };
  if (media) entry.media = media;

  const prev = Array.isArray(conv.messages) ? (conv.messages as { role: string; content: string }[]) : [];
  const updated = [...prev, entry].slice(-20);

  await supabase
    .from("whatsapp_conversations")
    .update({
      messages: updated,
      last_human_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conv.id);
}

// ── Link patient to conversation ───────────────────────────────────────────

export async function linkPatientAction(
  conversationId: string,
  patientId: string,
): Promise<void> {
  await linkEntityToConversation(conversationId, { patientId });
  revalidatePath("/whatsapp");
}
