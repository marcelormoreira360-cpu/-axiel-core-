import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
  }

  try {
    const { transcript, patientName } = await req.json();
    if (!transcript?.trim()) {
      return NextResponse.json({ error: "Transcrição vazia" }, { status: 400 });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente clínico especializado. Analise o relato de uma teleconsulta e extraia as informações de forma estruturada, clara e em português. Seja objetivo e clínico.",
          },
          {
            role: "user",
            content: `Relato da teleconsulta com paciente ${patientName}:\n\n${transcript}\n\nGere um JSON com os seguintes campos:\n- resumo: string (2-4 frases resumindo o que foi tratado na consulta)\n- decisoes: string[] (lista do que foi decidido, prescrito ou recomendado)\n- pendencias: string[] (o que ficou pendente, exames solicitados, retornos, acompanhamentos)\n- proxima_sessao: string (sugestão de foco para a próxima sessão)\n- notas_clinicas: string (observações clínicas relevantes sobre o estado do paciente)`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
    }

    const data = await res.json();
    const summary = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(summary);
  } catch (err: unknown) {
    console.error("Summary error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar resumo" },
      { status: 500 }
    );
  }
}
