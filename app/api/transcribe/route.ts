import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";
import { createLogger } from "@/lib/logger";
import { recordSttUsage } from "@/services/stt-usage-service";

const log = createLogger("transcribe");

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Clinic resolution + feature gate: audio_transcription ──────────────────
  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.clinic_id) {
    const billingCtx = await getBillingContext(profile.clinic_id);
    if (!canUseFeature(billingCtx, "audio_transcription")) {
      return NextResponse.json(
        { error: "Transcrição por voz disponível no plano Professional ou superior." },
        { status: 403 }
      );
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Arquivo de áudio obrigatório" }, { status: 400 });
    }

    // ── Mime type validation ────────────────────────────────────────────────
    const ALLOWED_MIME_TYPES = new Set([
      "audio/webm",
      "audio/webm;codecs=opus",
      "audio/ogg",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/m4a",
    ]);
    const mimeType = (file as File).type ?? "";
    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      return NextResponse.json(
        { error: `Tipo de arquivo não suportado: ${mimeType}` },
        { status: 415 }
      );
    }

    // ── Size limit: 25 MB (Whisper's hard limit) ────────────────────────────
    const MAX_BYTES = 25 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo permitido: 25 MB." },
        { status: 413 }
      );
    }

    const whisperForm = new FormData();
    const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") || mimeType.includes("m4a") ? "mp4" : mimeType.includes("wav") ? "wav" : mimeType.includes("mpeg") || mimeType.includes("mp3") ? "mp3" : "webm";
    whisperForm.append("file", file, `audio.${ext}`);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "pt");
    // verbose_json traz a duração do áudio (segundos) para medir uso de STT.
    whisperForm.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Whisper error ${res.status}`);
    }

    const data = await res.json();
    // Mede uso de STT (best-effort). AWAIT de propósito: em serverless, trabalho
    // não-aguardado após a resposta pode ser descartado, perdendo o dado de
    // cobrança. O helper tem try/catch interno, então awaitar não quebra o fluxo.
    await recordSttUsage({ clinicId: profile?.clinic_id ?? null, channel: "session", seconds: Number(data.duration) || 0 });
    return NextResponse.json({ text: data.text ?? "" });
  } catch (err: unknown) {
    log.error("Transcription error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro na transcrição" },
      { status: 500 }
    );
  }
}
