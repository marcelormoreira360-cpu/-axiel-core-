import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppMedia, formatReportForTTS } from "@/services/whatsapp-service";

// Gera áudio TTS via OpenAI, salva no bucket PRIVADO patient-docs e envia ao
// paciente via WhatsApp usando URL assinada com expiração (dados clínicos
// nunca ficam em bucket público — fix da auditoria de 10/06/2026).
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h: margem p/ retry de entrega do Twilio

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Escopo de clínica explícito (defesa em profundidade, mesmo padrão de /api/whatsapp/send)
  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Usuário sem clínica associada." }, { status: 403 });
  }

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
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle();

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
    const fileName = `voice-reports/${profile.clinic_id}/${patientId}-${Date.now()}.mp3`;

    // Upload no bucket PRIVADO patient-docs (admin client; rota já autenticada e escopada)
    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage
      .from("patient-docs")
      .upload(fileName, Buffer.from(audioBuffer), {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

    const { data: signed, error: signError } = await admin.storage
      .from("patient-docs")
      .createSignedUrl(fileName, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      throw new Error("Não foi possível gerar URL assinada do áudio");
    }

    // Send via WhatsApp as voice message
    await sendWhatsAppMedia(
      patient.phone,
      `🎙️ Relatório de saúde — ${patientName ?? patient.full_name}`,
      signed.signedUrl
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
