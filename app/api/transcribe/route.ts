import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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

    const whisperForm = new FormData();
    whisperForm.append("file", file, "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "pt");

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
    return NextResponse.json({ text: data.text ?? "" });
  } catch (err: unknown) {
    console.error("Transcription error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro na transcrição" },
      { status: 500 }
    );
  }
}
