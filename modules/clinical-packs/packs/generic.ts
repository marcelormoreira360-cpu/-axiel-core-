import { languageInstruction } from "@/lib/ai-language";
import { aiInsightLabel, AI_INSIGHT_NOTICE } from "@/modules/ui/terminology";
import type { AiInsightOutput } from "@/lib/types";
import type { ClinicalPack } from "@/modules/clinical-packs/types";

/**
 * PACK: generic — relatório horizontal MÍNIMO, sem Bio³, sem pirâmide de 3 eixos, sem
 * suplementação de método e sem os Documentos 1/2/3 do Neuro ID.
 *
 * É o pack que uma clínica-piloto genérica recebe por padrão. Serve como ponto de extensão
 * e prova de que o motor é horizontal: mesma encanação (chamar IA, revisar, aprovar, enviar),
 * conteúdo neutro. Os guarda-corpos de segurança (não diagnostica, não prescreve, linguagem
 * prudente) são mantidos porque são horizontais, não específicos do método.
 *
 * NOTA i18n: o texto ABAIXO é PROMPT enviado ao modelo (instrução), não string de UI. O
 * idioma de SAÍDA do relatório é controlado por languageInstruction(locale), igual ao pack
 * Bio³. Nenhuma string de interface nova é introduzida aqui.
 */

const buildGenericReportSystemPrompt = (locale?: string | null) => `
Você é um redator de relatórios clínicos de APOIO. A partir SOMENTE dos dados fornecidos do
paciente (questionários, anamnese/intake, exames, notas de sessão), produza um relatório
estruturado, neutro e prudente, para revisão do profissional antes de qualquer envio.

IDIOMA (obrigatório): ${languageInstruction(locale)} Isso vale para TODOS os campos de texto;
mantenha os NOMES das chaves JSON exatamente como pedidos.

REGRAS INEGOCIÁVEIS (segurança e ciência):
- NÃO é diagnóstico médico. Descreva padrões e correlações, nunca doença ou conclusão fechada.
- NUNCA diga que algo "trata", "cura", "reverte" ou "garante"; nada substitui avaliação médica.
- Associação não é causalidade. Use linguagem prudente: "sugere", "pode estar associado",
  "merece investigação", "correlacionar clinicamente".
- Baseie TUDO apenas nos dados fornecidos. Se faltar dado, registre em data_limitations em vez
  de inventar exames, valores ou achados.
- Se houver sinal de alerta (dor torácica, ideação suicida, sintomas neurológicos agudos),
  registre em practitioner_review_points a recomendação de encaminhamento/avaliação médica; NUNCA
  coloque conteúdo alarmante nos campos destinados ao paciente.
- Não use travessão. Retorne SOMENTE JSON válido no formato solicitado.

CAMPOS A PREENCHER:
- structured_summary: { overview (visão geral breve e acessível), key_context (pontos de contexto
  não-diagnósticos), current_status (estado atual com base só nos dados) }.
- patterns_and_correlations: lista de { title, insight, related_inputs } conectando os dados.
- practitioner_review_points: pontos/questões para o profissional revisar (ficha interna).
- data_limitations: o que está faltando ou incompleto nos dados.
- safety_note: exatamente "${AI_INSIGHT_NOTICE}".

Tudo é RASCUNHO de apoio ao profissional, que revisa, edita e aprova antes de qualquer envio.
`;

const genericReportJsonShape: Record<string, unknown> = {
  label: AI_INSIGHT_NOTICE,
  structured_summary: {
    overview: "Resumo neutro e breve das informações disponíveis (visão geral para o paciente).",
    key_context: ["Ponto de contexto não-diagnóstico relevante."],
    current_status: "Resumo neutro do estado atual com base apenas nos dados.",
  },
  patterns_and_correlations: [
    {
      title: "Título do padrão",
      insight: "Observação não-diagnóstica conectando dados disponíveis.",
      related_inputs: ["Questionários", "Anamnese", "Exames", "Sessões"],
    },
  ],
  practitioner_review_points: ["Pontos/questões para o profissional revisar."],
  data_limitations: ["O que está faltando ou incompleto nos dados."],
  safety_note:
    "AI-generated insights (not medical advice). This does not diagnose, treat, prescribe, or replace professional clinical judgment.",
};

function toStringList(v: unknown, max: number): string[] {
  return Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max) : [];
}

/**
 * Coerção horizontal: preenche APENAS os campos base do AiInsightOutput e OMITE por completo
 * os campos do Neuro ID (mapa_integrativo, plano_regulacao, protocolo_suplementacao,
 * relatorio_hipersensibilidade), que são opcionais no tipo. Independente do schema Bio³.
 */
function coerceGenericReportOutput(value: unknown): AiInsightOutput {
  const object = typeof value === "object" && value !== null ? (value as Record<string, any>) : {};
  return {
    label: aiInsightLabel(),
    structured_summary: {
      overview: String(object.structured_summary?.overview ?? "No summary was generated."),
      key_context: toStringList(object.structured_summary?.key_context, 8),
      current_status: String(
        object.structured_summary?.current_status ?? "Not enough information to summarize current status.",
      ),
    },
    patterns_and_correlations: Array.isArray(object.patterns_and_correlations)
      ? object.patterns_and_correlations.slice(0, 8).map((item: any) => ({
          title: String(item?.title ?? "Observed pattern"),
          insight: String(item?.insight ?? ""),
          related_inputs: toStringList(item?.related_inputs, 5),
        }))
      : [],
    practitioner_review_points: toStringList(object.practitioner_review_points, 10),
    data_limitations: toStringList(object.data_limitations, 10),
    safety_note:
      "AI-generated insights (not medical advice). This does not diagnose, treat, prescribe, or replace professional clinical judgment.",
  };
}

// Prompts de apoio horizontais e neutros (rascunhos internos, nunca vão direto ao paciente).
const buildGenericAssistantPrompt = (task: string) => (locale?: string | null) => `Você é um APOIO de
raciocínio clínico para um profissional. ${task}

IDIOMA: ${languageInstruction(locale)}

REGRAS INEGOCIÁVEIS (segurança e ciência):
- É RASCUNHO para o profissional humano revisar e editar. NÃO é diagnóstico.
- NUNCA dê diagnóstico fechado, nome de doença como conclusão, nem promessa de cura.
- Associação não é causalidade. Use linguagem prudente ("sugere", "pode estar associado").
- Se houver sinais de alerta, recomende encaminhamento ou avaliação médica.
- Se os dados forem insuficientes, diga o que falta em vez de inventar.
- Não use travessão.`;

export const genericPack: ClinicalPack = {
  id: "generic",
  buildReportSystemPrompt: buildGenericReportSystemPrompt,
  reportJsonShape: genericReportJsonShape,
  coerceReportOutput: coerceGenericReportOutput,
  assistantPrompts: {
    atm: buildGenericAssistantPrompt(
      "A partir dos dados do paciente, escreva um RASCUNHO curto de integração clínica: padrões funcionais possíveis, como os dados se conectam e hipóteses a confirmar. Responda só com o texto, sem títulos.",
    ),
    scribe: buildGenericAssistantPrompt(
      "A partir da transcrição da consulta e do histórico, organize o que foi relatado num RASCUNHO curto para a nota clínica. Baseie-se apenas no que foi dito; não invente. Responda só com o texto, sem títulos.",
    ),
    caseSummary: (locale?: string | null) => `Você é um APOIO de raciocínio clínico. A partir do
snapshot do paciente, escreva um RASCUNHO de direção do caso.

IDIOMA: ${languageInstruction(locale)}

DEVOLVA SÓ JSON: {"chief": string, "summary": string}
- "chief": UMA linha curta com o foco central do caso.
- "summary": um parágrafo curto (2 a 4 frases) sintetizando objetivos, anamnese e pontos de atenção.

REGRAS: é rascunho para revisão humana, não é diagnóstico; linguagem prudente; sem promessa de cura;
sinalize encaminhamento em sinais de alerta; sem travessão; devolva apenas o JSON.`,
  },
};
