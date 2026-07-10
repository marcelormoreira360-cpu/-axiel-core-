import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("stt-usage");

/**
 * Registra o uso de transcrição de voz (Whisper) por clínica, para cobrança por
 * uso real. `seconds` vem da duração retornada pelo Whisper (response_format
 * verbose_json). Best-effort: nunca quebra o fluxo de transcrição (se a tabela
 * ainda não existir ou a gravação falhar, apenas não registra).
 */
export async function recordSttUsage(input: {
  clinicId: string | null;
  channel: string;
  seconds: number;
}): Promise<void> {
  const seconds = Number.isFinite(input.seconds) && input.seconds > 0 ? input.seconds : 0;
  if (seconds <= 0) return;
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("stt_usage").insert({
      clinic_id: input.clinicId,
      channel: input.channel,
      seconds,
      minutes: Math.ceil(seconds / 60),
    });
  } catch (err) {
    log.warn("failed to record STT usage", { channel: input.channel, error: String(err) });
  }
}
