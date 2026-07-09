import OpenAI from "openai";
import { languageInstruction } from "@/lib/ai-language";
import { examLegendBlock } from "@/modules/neuro-id/exam-legends";
import {
  buildMetricExtractionPrompt,
  coerceExamMetricsDraft,
  type ExamInstrument,
} from "@/modules/neuro-id/exam-metrics";

/**
 * Análise de exame funcional (PDF) pela IA — genérico (biorressonância, neurometria, etc.).
 * O modelo lê o PDF direto e devolve uma SÍNTESE CONCISA para o Relatório Funcional
 * Integrado (Doc 1), que não pode passar de ~1,5 página. Não inventa: baseia-se só no exame.
 *
 * Para neurometria e biorressonância, anexa a LEGENDA do exame (modules/neuro-id/exam-legends)
 * para que a leitura seja ancorada na mesma interpretação clínica da clínica (verdadeira e
 * verificável), em vez de interpretação livre do modelo.
 */

// A síntese entra no Relatório Funcional Integrado (Doc 1) enviado ao PACIENTE →
// o idioma segue o locale do paciente (resolvido pelo call site via resolvePatientLocale).
const buildExamSynthesisSystemPrompt = (locale?: string | null) => `
Você é o analista de exames funcionais de um Integrative & Functional Wellness Center
(metodologia Neuro ID). Recebe o PDF de um exame e produz uma SÍNTESE CONCISA
para entrar no Relatório Funcional Integrado.

IDIOMA: ${languageInstruction(locale)}

Regras:
- CONCISO acima de tudo: no máximo ~120 palavras no total. O relatório final não pode
  passar de 1,5 página e ainda terá outros exames.
- Biorressonância/bioenergético emocional: liste de 6 a 10 EMOÇÕES/TEMAS mais ALTERADOS
  (os de maior valor/intensidade no exame) e feche com 1–2 frases de síntese da leitura emocional.
- Neurometria ou outros: extraia os 5–8 achados mais relevantes + 1 frase de síntese.
- Linguagem acolhedora e PRUDENTE: "o exame sugere / registra / aponta", nunca diagnóstico fechado.
- NUNCA comente o grau de evidência científica do exame ou do método (proibido "evidência científica
  limitada", "não comprovado", "método não reconhecido" e variações). Descreva apenas o que o exame registrou.
- Baseie-se SOMENTE no conteúdo do exame anexado. Se não der para ler, diga isso em 1 linha.
- Saída em texto simples (pode usar bullets curtos). Sem títulos longos, sem repetir o cabeçalho do exame.
`;

/**
 * Extrai marcadores de um exame LABORATORIAL (sangue, etc.) de uma FOTO ou PDF.
 * A IA só TRANSCREVE o que está no documento (biomarcador, valor, unidade, faixa
 * de referência); não interpreta nem inventa. Devolve um RASCUNHO para o terapeuta
 * revisar e validar antes de salvar. Sem chave/erro -> [] (não quebra o fluxo).
 */
export type LabMarkerDraft = {
  biomarker: string;
  value: number;
  unit: string | null;
  ref_min: number | null;
  ref_max: number | null;
};

const LAB_SYSTEM_PROMPT = `
Você transcreve resultados de exames laboratoriais (sangue, urina, etc.) de uma imagem ou PDF.
Regras (não negociáveis):
- Só TRANSCREVA o que está no documento. NÃO interprete, não calcule, não invente nenhum valor.
- Para cada marcador: nome (biomarker), valor numérico (value), unidade (unit) e a faixa de
  referência do laudo (ref_min e ref_max). Use ponto decimal. Se algo não estiver no documento, use null.
- Ignore cabeçalhos, textos de método e marcadores sem valor numérico.
- No máximo 60 marcadores.
Responda SOMENTE com JSON no formato exato:
{ "markers": [ { "biomarker": string, "value": number, "unit": string|null, "ref_min": number|null, "ref_max": number|null } ] }
`;

function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function extractLabMarkers(opts: {
  fileBase64: string;   // base64 puro (sem prefixo data:)
  mimeType: string;     // image/* ou application/pdf
  filename: string;
}): Promise<LabMarkerDraft[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const isPdf = opts.mimeType === "application/pdf";
  const filePart = isPdf
    ? { type: "file", file: { filename: opts.filename || "exame.pdf", file_data: `data:application/pdf;base64,${opts.fileBase64}` } }
    : { type: "image_url", image_url: { url: `data:${opts.mimeType};base64,${opts.fileBase64}` } };

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: LAB_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            filePart as never,
            { type: "text", text: "Transcreva os marcadores deste exame e responda só com o JSON pedido." },
          ],
        },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return []; }
    const arr = (parsed as { markers?: unknown[] })?.markers ?? [];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m) => {
        const o = (m ?? {}) as Record<string, unknown>;
        const biomarker = String(o.biomarker ?? "").trim();
        const value = numOrNull(o.value);
        if (!biomarker || value === null) return null;
        const unit = o.unit == null ? null : String(o.unit).trim() || null;
        return { biomarker, value, unit, ref_min: numOrNull(o.ref_min), ref_max: numOrNull(o.ref_max) };
      })
      .filter((x): x is LabMarkerDraft => x !== null)
      .slice(0, 60);
  } catch {
    return [];
  }
}

export async function analyzeExamPdf(opts: {
  pdfBase64: string;       // base64 puro (sem prefixo data:)
  filename: string;
  examType: string;        // 'biorressonancia' | 'neurometria' | 'outro'
  examTitle?: string | null;
  /** Locale do PACIENTE (resolvePatientLocale) — a síntese entra no relatório dele. */
  locale?: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const label = opts.examType === "biorressonancia"
    ? "exame de biorressonância emocional"
    : opts.examType === "neurometria"
      ? "exame de neurometria"
      : `exame${opts.examTitle ? ` (${opts.examTitle})` : ""}`;

  const base = buildExamSynthesisSystemPrompt(opts.locale);
  const legend = examLegendBlock(opts.examType);
  const systemPrompt = legend ? `${base}\n\n${legend}` : base;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
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

/**
 * Extrai do PDF do exame os VALORES BRUTOS das métricas Bio³ (incremento 3),
 * por code (ex.: neuro_temperatura, neuro_sna_balance, bio_carga_emocional).
 * A IA só transcreve o que está no exame (ancorada na legenda); a conversão
 * para disfunção 0–100 é determinística (examMetricContributions/computeNeuroId).
 *
 * Retorna um RASCUNHO { code: valorBruto } para REVISÃO HUMANA antes de entrar
 * na pirâmide (gate, incremento 4). Só neurometria/biorressonância têm métricas;
 * outros tipos -> {}. Falha de IA/sem chave -> {} (não quebra o upload).
 */
export async function extractExamMetrics(opts: {
  pdfBase64: string;
  filename: string;
  examType: string; // 'neurometria' | 'biorressonancia' | 'outro'
}): Promise<Record<string, number>> {
  if (opts.examType !== "neurometria" && opts.examType !== "biorressonancia") return {};
  if (!process.env.OPENAI_API_KEY) return {};
  const instrument = opts.examType as ExamInstrument;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const legend = examLegendBlock(instrument);
  const systemPrompt = `${buildMetricExtractionPrompt(instrument)}${legend ? `\n\n${legend}` : ""}`;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
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
            { type: "text", text: "Extraia os valores medidos conforme as regras e responda só com o JSON pedido." },
          ],
        },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    return coerceExamMetricsDraft(parsed, instrument);
  } catch {
    return {};
  }
}
