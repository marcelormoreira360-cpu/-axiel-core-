import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWhatsAppMedia, formatReportForTTS } from "@/services/whatsapp-service";

// Generates TTS audio via OpenAI and uploads to a public URL via Supabase Storage,
// then sends as WhatsApp voice message via Twilio.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
  }

  try {
    const { patientId, report, patientName } = await req.json();
    if (!patientId || !report) {
      return NextResponse.json({ error: "patientId e report são obrigatórios" }, { status: 400 });
    }

    const { data: patient } = await supabase
      .from("patients")
      .select("full_name, phone")
      .eq("id", patientId)
      .single();

    if (!patient?.phone) {
      return NextResponse.json({ error: "Paciente não possui telefone cadastrado" }, { status: 400 });
    }

    // Generate TTS audio
    const ttsText = formatReportForTTS(report);
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        input: ttsText,
        voice: "nova",
        response_format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `TTS error ${ttsRes.status}`);
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const fileName = `whatsapp-reports/${patientId}-${Date.now()}.mp3`;

    // Upload to Supabase Storage (bucket: "media", must be public)
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, Buffer.from(audioBuffer), {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(fileName);
    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) throw new Error("Não foi possível obter URL pública do áudio");

    // Send via WhatsApp as voice message
    await sendWhatsAppMedia(
      patient.phone,
      `🎙️ Relatório de saúde — ${patientName ?? patient.full_name}`,
      publicUrl
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("WhatsApp voice send error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
