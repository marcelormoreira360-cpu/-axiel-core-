/**
 * Worker de mídia (item 6 Fase 1): fila de envio de IMAGEM em DM do Instagram.
 *
 * O webhook não pode bloquear subindo/gerando imagem, então o envio é
 * enfileirado em outbound_media_jobs (migration 133) e processado por um cron
 * (app/api/cron/media-worker). Aqui ficam: enqueueOutboundMedia (produtor) e
 * processOutboundMediaJobs (consumidor).
 *
 * Resolução da URL pública (prioridade): media_url pronta > storage_path (URL
 * assinada na hora) > generate_prompt (a IA gera, sobe no Storage e assina).
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";
import { sendInstagramImage, sendInstagramText } from "@/lib/instagram-api";
import { generateImagePng } from "@/lib/openai-image";

const log = createLogger("outbound-media");

// Bucket privado já existente (mesmo usado pelo áudio do WhatsApp). A Meta busca
// a imagem por URL assinada de curta duração.
const BUCKET = "patient-docs";
const SIGNED_URL_TTL_SECONDS = 600; // 10 min — folga p/ a Meta buscar a imagem

type Channel = "instagram" | "messenger";
type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export type EnqueueOutboundMediaInput = {
  clinicId: string;
  channel: Channel;
  recipientId: string;
  igAccountId?: string | null;
  conversationKey?: string | null;
  storagePath?: string | null;
  mediaUrl?: string | null;
  generatePrompt?: string | null;
  caption?: string | null;
  createdBy?: string | null;
};

/** Enfileira um envio de imagem. Exige ao menos uma fonte de mídia. */
export async function enqueueOutboundMedia(input: EnqueueOutboundMediaInput): Promise<string> {
  if (!input.storagePath && !input.mediaUrl && !input.generatePrompt) {
    throw new Error("enqueueOutboundMedia: informe storagePath, mediaUrl ou generatePrompt.");
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("outbound_media_jobs")
    .insert({
      clinic_id: input.clinicId,
      channel: input.channel,
      recipient_id: input.recipientId,
      ig_account_id: input.igAccountId ?? null,
      conversation_key: input.conversationKey ?? null,
      storage_path: input.storagePath ?? null,
      media_url: input.mediaUrl ?? null,
      generate_prompt: input.generatePrompt ?? null,
      caption: input.caption ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

type MediaJob = {
  id: string;
  clinic_id: string;
  channel: Channel;
  recipient_id: string;
  ig_account_id: string | null;
  conversation_key: string | null;
  storage_path: string | null;
  media_url: string | null;
  generate_prompt: string | null;
  caption: string | null;
  attempts: number;
  max_attempts: number;
};

const JOB_COLUMNS =
  "id, clinic_id, channel, recipient_id, ig_account_id, conversation_key, storage_path, media_url, generate_prompt, caption, attempts, max_attempts";

/**
 * Processa os jobs pendentes. Roda no cron (service role). Cada job é reivindicado
 * de forma atômica (update condicional status pending -> sending) para dois runs
 * concorrentes nunca enviarem o mesmo. Falha devolve para 'pending' até esgotar
 * max_attempts, quando vira 'failed'.
 */
const STALE_SENDING_MS = 5 * 60_000; // 5 min: um 'sending' mais velho = worker morto

export async function processOutboundMediaJobs(limit = 10): Promise<{ sent: number; failed: number }> {
  const supabase = createSupabaseAdminClient();

  // Reclaim: jobs presos em 'sending' (worker crashou após reivindicar) voltam
  // para 'pending'. O attempts do run crashado já foi contado no claim, então
  // não incrementa aqui; o cap de max_attempts continua limitando o total.
  const staleCutoff = new Date(Date.now() - STALE_SENDING_MS).toISOString();
  await supabase
    .from("outbound_media_jobs")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("status", "sending")
    .lt("updated_at", staleCutoff);

  const { data: jobs } = await supabase
    .from("outbound_media_jobs")
    .select(JOB_COLUMNS)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  let sent = 0;
  let failed = 0;

  for (const job of (jobs ?? []) as MediaJob[]) {
    // Reivindicação atômica: só um run marca pending -> sending.
    const { data: claimed } = await supabase
      .from("outbound_media_jobs")
      .update({ status: "sending", attempts: job.attempts + 1, updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // outro run pegou este job

    try {
      const url = await resolveMediaUrl(supabase, job);
      await deliver(job, url);
      await supabase
        .from("outbound_media_jobs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const exhausted = job.attempts + 1 >= job.max_attempts;
      await supabase
        .from("outbound_media_jobs")
        .update({
          status: exhausted ? "failed" : "pending", // devolve p/ retry enquanto houver tentativa
          last_error: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (exhausted) failed++;
      log.error("job falhou", e, { job: job.id, exhausted });
    }
  }

  return { sent, failed };
}

async function resolveMediaUrl(supabase: SupabaseAdmin, job: MediaJob): Promise<string> {
  if (job.media_url) return job.media_url;
  if (job.storage_path) return signedUrl(supabase, job.storage_path);

  if (job.generate_prompt) {
    const png = await generateImagePng(job.generate_prompt);
    const path = `outbound-media/${job.clinic_id}/${job.id}.png`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (error) throw new Error(`upload da imagem gerada: ${error.message}`);
    // Persiste o caminho para auditoria/reuso e para não regerar em um retry.
    await supabase.from("outbound_media_jobs").update({ storage_path: path }).eq("id", job.id);
    return signedUrl(supabase, path);
  }

  throw new Error("job sem fonte de mídia (media_url/storage_path/generate_prompt)");
}

async function signedUrl(supabase: SupabaseAdmin, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(`URL assinada: ${error?.message ?? "sem url"}`);
  }
  return data.signedUrl;
}

async function deliver(job: MediaJob, url: string): Promise<void> {
  if (job.channel === "instagram") {
    const igAccountId = job.ig_account_id ?? "";
    await sendInstagramImage(job.recipient_id, url, igAccountId);
    // Legenda vai como texto separado (o attachment de imagem não carrega caption).
    if (job.caption) await sendInstagramText(job.recipient_id, job.caption, igAccountId);
    return;
  }
  // Messenger: coluna/enum já preparados, mas o send de imagem ainda não foi feito.
  throw new Error(`canal '${job.channel}' ainda não suportado pelo worker de mídia`);
}
