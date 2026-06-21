import OpenAI from "openai";

/**
 * Análise de exame funcional (PDF) pela IA — genérico (biorressonância, neurometria, etc.).
 * O modelo lê o PDF direto e devolve uma SÍNTESE CONCISA para o Relatório Funcional
 * Integrado (Doc 1), que não pode passar de ~1,5 página. Não inventa: baseia-se só no exame.
 */

const SYSTEM_PROMPT = `
Você é o analista de exames funcionais de um Integrative & Functional Wellness Center
(metodologia Neuro ID). Recebe o PDF de um exame e produz uma SÍNTESE CONCISA em
português (pt-BR) para entrar no Relatório Funcional Integrado.

Regras:
- CONCISO acima de tudo: no máximo ~120 palavras no total. O relatório final não pode
  passar de 1,5 página e ainda terá outros exames.
- Biorressonância/bioenergético emocional: liste de 6 a 10 EMOÇÕES/TEMAS mais ALTERADOS
  (os de maior valor/intensidade no exame) e feche com 1–2 frases de síntese da leitura emocional.
- Neurometria ou outros: extraia os 5–8 achados mais relevantes + 1 frase de síntese.
- Linguagem acolhedora e PRUDENTE: "o exame sugere / registra / aponta", nunca diagnóstico fechado.
- Baseie-se SOMENTE no conteúdo do exame anexado. Se não der para ler, diga isso em 1 linha.
- Saída em texto simples (pode usar bullets curtos). Sem títulos longos, sem repetir o cabeçalho do exame.
`;

export async function analyzeExamPdf(opts: {
  pdfBase64: string;       // base64 puro (sem prefixo data:)
  filename: string;
  examType: string;        // 'biorressonancia' | 'neurometria' | 'outro'
  examTitle?: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const label = opts.examType === "biorressonancia"
    ? "exame de biorressonância emocional"
    : opts.examType === "neurometria"
      ? "exame de neurometria"
      : `exame${opts.examTitle ? ` (${opts.examTitle})` : ""}`;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: opts.filename || "exame.pdf",
                file_data: `data:application/pdf;base64,${opts.pdfBase64}`,
              },
            } as never,
            { type: "text", text: `Analise este ${label} e produza a síntese concisa conforme as regras.` },
          ],
        },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim();
    return text && text.length > 0 ? text.slice(0, 1800) : null;
  } catch {
    return null;
  }
}
