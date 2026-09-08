import OpenAI from "openai";
import { languageInstruction } from "@/lib/ai-language";
import { reportModel } from "@/lib/ai-models";
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
// Regra de extração ESPECÍFICA por tipo de exame. Antes o prompt trazia as duas
// instruções juntas (biorressonância + neurometria) para TODO exame, e o modelo
// misturava: uma neurometria saía rotulada "Biorressonância/Bioenergético Emocional"
// (o aparelho tem índices emocionais), colidindo com o exame de biorressonância e
// poluindo o slot bioemocional do Doc 1. Agora cada tipo recebe só a sua regra.
function examTypeRule(examType: string): string {
  if (examType === "biorressonancia") {
    return `- Este é o exame de BIORRESSONÂNCIA / bioenergético emocional: liste de 6 a 10 EMOÇÕES/TEMAS
  mais ALTERADOS (os de maior valor/intensidade) e feche com 1–2 frases de síntese emocional.`;
  }
  if (examType === "neurometria") {
    return `- Este é o exame de NEUROMETRIA (índices autonômicos/cardio-cerebrais, HRV, regulação,
  adaptação, barorreflexo, hemodinâmica): extraia os 5–8 achados neurométricos mais relevantes
  + 1 frase de síntese. NÃO rotule a saída como "Biorressonância" nem crie seção "Bioenergético
  Emocional" — isso pertence a OUTRO exame. Se o aparelho trouxer índices de ansiedade/emocionais,
  descreva-os como parte da leitura NEUROMÉTRICA/autonômica, não como biorressonância.`;
  }
  return `- Extraia os 5–8 achados mais relevantes do exame + 1 frase de síntese.`;
}

const buildExamSynthesisSystemPrompt = (examType: string, locale?: string | null) => `
Você é o analista de exames funcionais de um Integrative & Functional Wellness Center
(metodologia Neuro ID). Recebe o PDF de um exame e produz uma SÍNTESE CONCISA
para entrar no Relatório Funcional Integrado.

IDIOMA: ${languageInstruction(locale)}

Regras:
- CONCISO acima de tudo: no máximo ~120 palavras no total. O relatório final não pode
  passar de 1,5 página e ainda terá outros exames.
${examTypeRule(examType)}
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
  const model = reportModel();

  const isPdf = opts.mimeType === "application/pdf";
  const filePart = isPdf
    ? { type: "file", file: { filename: opts.filename || "exame.pdf", file_data: `data:application/pdf;base64,${opts.fileBase64}` } }
    : { type: "image_url", image_url: { url: `data:${opts.mimeType};base64,${opts.fileBase64}` } };

  try {
    const response = await client.chat.completions.create({
      store: false, // PHI: nao reter a conversa no provedor (defesa em profundidade; BAA e o controle primario)
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

/**
 * Resumo clínico CONCISO de um DOCUMENTO anexado do paciente (seção "Documentos"):
 * PDF/imagem (exame, laudo, histórico, receita...) → síntese dos achados relevantes para a
 * suplementação/relatório. Retorna null se não houver conteúdo clínico útil ou não der para ler.
 * É best-effort e barato: entra no insight como mais uma fonte (input_data.documents).
 */
export async function summarizeClinicalDocument(opts: {
  fileBase64: string;
  mimeType: string;
  filename: string;
  locale?: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = reportModel();

  const isPdf = opts.mimeType === "application/pdf";
  const isImage = opts.mimeType.startsWith("image/");
  if (!isPdf && !isImage) return null;
  const filePart = isPdf
    ? { type: "file", file: { filename: opts.filename || "documento.pdf", file_data: `data:application/pdf;base64,${opts.fileBase64}` } }
    : { type: "image_url", image_url: { url: `data:${opts.mimeType};base64,${opts.fileBase64}` } };

  const system = `Você é o analista clínico de um Integrative & Functional Wellness Center (método Neuro ID).
Recebe um DOCUMENTO anexado do paciente e produz uma SÍNTESE CONCISA (máx. ~100 palavras) dos achados
CLINICAMENTE RELEVANTES (exames/laudos, marcadores fora da faixa, histórico, medicações, alergias).
IDIOMA: ${languageInstruction(opts.locale)}
Regras:
- Só o que estiver no documento; nunca invente. Linguagem prudente ("o documento registra/sugere").
- NUNCA comente grau de evidência científica do método.
- Se o documento NÃO tiver conteúdo clínico útil (ex.: consentimento, recibo, foto sem dado), responda exatamente: SEM_CONTEUDO_CLINICO.
- Saída em texto simples curto (pode usar bullets), sem repetir cabeçalho do documento.`;

  try {
    const response = await client.chat.completions.create({
      store: false, // PHI: nao reter a conversa no provedor (defesa em profundidade; BAA e o controle primario)
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: [filePart as never, { type: "text", text: "Resuma os achados clínicos relevantes deste documento conforme as regras." }] },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (!text || text.length === 0) return null;
    if (text.toUpperCase().includes("SEM_CONTEUDO_CLINICO")) return null;
    return text.slice(0, 1200);
  } catch {
    return null;
  }
}

/**
 * Prompt de extração do TESTE CAPILAR (hipersensibilidade). Diferente dos outros
 * exames: NÃO é síntese curta de ~120 palavras — precisa capturar TODOS os itens
 * reativos (alta/moderada) por categoria, pois alimentam o Documento 3 (dieta de
 * eliminação). A legenda (TESTE_CAPILAR_LEGEND) é anexada pelo chamador.
 */
const buildHairTestExtractionSystemPrompt = (locale?: string | null) => `
Você é o analista de exames funcionais de um Integrative & Functional Wellness Center
(metodologia Neuro ID). Recebe o PDF do TESTE CAPILAR de hipersensibilidade e produz
uma EXTRAÇÃO ESTRUTURADA E COMPLETA dos itens reativos, para montar o Documento 3.

IDIOMA: ${languageInstruction(locale)}

Regras:
- COMPLETUDE acima de tudo: liste TODOS os itens de reatividade ALTA e MODERADA, por
  extenso e por categoria. NÃO resuma como "vários"/"entre outros"; nomeie cada item.
- Use as LISTAS DE TEXTO de "High Reactivity" e "Moderate Reactivity" de cada seção como
  fonte primária (mais confiáveis que as bolinhas coloridas). Ignore "No Reactivity".
- Estruture a saída EXATAMENTE assim, em texto simples:
  REATIVIDADE ALTA:
  - [Categoria]: item, item, item...
  REATIVIDADE MODERADA:
  - [Categoria]: item, item, item...
  NÍVEIS FORA DA FAIXA (não é reatividade — para suplementação/Bio³):
  - item (seção), item (seção)...
  Categorias de reatividade: Alimentos & bebidas, Vegano, Não-alimentar, Metal, Aditivos.
- Linguagem prudente: "o exame registrou reatividade a…"; NUNCA "alergia"/diagnóstico.
- NUNCA comente grau de evidência científica do exame/método.
- Baseie-se SOMENTE no PDF. Se não der para ler, diga isso em 1 linha.
`;

export async function analyzeExamPdf(opts: {
  pdfBase64: string;       // base64 puro (sem prefixo data:)
  filename: string;
  examType: string;        // 'biorressonancia' | 'neurometria' | 'teste_capilar' | 'outro'
  examTitle?: string | null;
  /** Locale do PACIENTE (resolvePatientLocale) — a síntese entra no relatório dele. */
  locale?: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = reportModel();

  const isHairTest = opts.examType === "teste_capilar";
  const label = opts.examType === "biorressonancia"
    ? "exame de biorressonância emocional"
    : opts.examType === "neurometria"
      ? "exame de neurometria"
      : isHairTest
        ? "teste capilar de hipersensibilidade (reatividade alimentar/química)"
        : `exame${opts.examTitle ? ` (${opts.examTitle})` : ""}`;

  // Teste capilar: extração completa (não a síntese curta de Doc 1). Demais exames:
  // síntese concisa (~120 palavras) para o Relatório Funcional Integrado.
  const base = isHairTest
    ? buildHairTestExtractionSystemPrompt(opts.locale)
    : buildExamSynthesisSystemPrompt(opts.examType, opts.locale);
  const legend = examLegendBlock(opts.examType);
  const systemPrompt = legend ? `${base}\n\n${legend}` : base;

  try {
    const response = await client.chat.completions.create({
      store: false, // PHI: nao reter a conversa no provedor (defesa em profundidade; BAA e o controle primario)
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
            { type: "text", text: isHairTest
                ? `Analise este ${label} e produza a EXTRAÇÃO ESTRUTURADA E COMPLETA (todos os itens reativos por categoria e nível) conforme as regras.`
                : `Analise este ${label} e produza a síntese concisa conforme as regras.` },
          ],
        },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim();
    // Teste capilar precisa caber a lista completa (dieta de eliminação); demais exames
    // são síntese curta para o Doc 1.
    const cap = isHairTest ? 8000 : 1800;
    return text && text.length > 0 ? text.slice(0, cap) : null;
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
  const model = reportModel();

  const legend = examLegendBlock(instrument);
  const systemPrompt = `${buildMetricExtractionPrompt(instrument)}${legend ? `\n\n${legend}` : ""}`;

  try {
    const response = await client.chat.completions.create({
      store: false, // PHI: nao reter a conversa no provedor (defesa em profundidade; BAA e o controle primario)
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
