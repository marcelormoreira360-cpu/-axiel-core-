import OpenAI from "openai";
import type { AiInsightOutput } from "@/lib/types";
import { reportModel, deepReportModel, isReasoningModel, reasoningEffort } from "@/lib/ai-models";
import { resolvePatientLocale } from "@/lib/email-i18n";
import { resolveClinicalPack } from "@/modules/clinical-packs/resolve";
import { buildAiInsightInput, type AiInsightInputSnapshot } from "@/services/ai-insight/input-builder";
import { buildCaseSummaryFallback, stripDash, type CaseSummaryDraft } from "@/services/ai-insight/case-summary";
import { SUPPLEMENT_REASONING_VERSION } from "@/modules/ai-insights/supplement-reasoning";

export function buildAiFallbackOutput(reason: string): AiInsightOutput {
  return {
    label: "AI-generated insights (not medical advice)",
    structured_summary: {
      overview: "AI insight generation was not completed. The available patient information remains safely stored for practitioner review.",
      key_context: ["Fallback mode was used because the AI provider was unavailable or misconfigured."],
      current_status: "Please review the intake, notes, and patient history manually.",
    },
    patterns_and_correlations: [],
    practitioner_review_points: ["Review patient intake responses.", "Review recent session notes.", "Decide the next operational follow-up step."],
    data_limitations: [reason],
    safety_note:
      "AI-generated insights (not medical advice). This does not diagnose, treat, prescribe, or replace professional clinical judgment.",
  };
}

export async function generateAiInsightOutput(input: AiInsightInputSnapshot): Promise<{ output: AiInsightOutput; tokensUsed?: number | null; modelUsed?: string | null }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local before generating insights.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // ENTREGÁVEL clínico (Doc 1 + suplementação): modelo mais forte / de raciocínio,
  // para analisar caso a caso em vez de convergir nos ativos "de livro-texto".
  const model = deepReportModel();
  const reasoning = isReasoningModel(model);

  // Motor HORIZONTAL: o método (prompt + schema + coerção) vem do Clinical Pack da clínica,
  // não de imports estáticos Bio³. O binding vem de clinics.clinical_pack_id (migration 156):
  // a IFWC resolve para bio3-neuroid pelo backfill no banco. Se a leitura falhar, o resolvedor
  // degrada para o pack NEUTRO "generic" (DEFAULT_CLINICAL_PACK_ID), nunca para o método proprietário.
  const pack = await resolveClinicalPack(input.patient.clinic_id);

  // Nível PACIENTE: o insight vira relatório enviado ao paciente após aprovação,
  // então o texto sai no idioma do paciente (patients.locale; fallback = clínica).
  const patientLocale = await resolvePatientLocale(input.patient.locale, input.patient.clinic_id);

  const response = await client.chat.completions.create({
    store: false, // PHI: nao reter a conversa no provedor (defesa em profundidade; BAA e o controle primario)
    model,
    // Modelos de raciocínio (série "o") rejeitam `temperature` e usam `reasoning_effort`;
    // os demais mantêm a temperatura baixa de sempre (saída clínica estável).
    ...(reasoning ? { reasoning_effort: reasoningEffort() } : { temperature: 0.2 }),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: pack.buildReportSystemPrompt(patientLocale) },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate structured insights only. No diagnosis. No session. No prescriptions.",
          required_output_shape: pack.reportJsonShape,
          input_data: input,
        }),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const output = pack.coerceReportOutput(parsed);
  // Carimba a versão do Protocolo dos 10 Filtros SÓ quando o pack realmente gerou
  // suplementação (Documento 2). Packs sem suplementação (ex.: "generic") não
  // recebem o carimbo, senão a fila de regeneração em massa (Fase 2) trataria
  // relatórios sem Doc 2 como "já atualizados".
  if (output.protocolo_suplementacao) {
    output.supplement_reasoning_version = SUPPLEMENT_REASONING_VERSION;
  }

  return {
    output,
    tokensUsed: response.usage?.total_tokens ?? null,
    // Modelo REAL retornado pela OpenAI (pode divergir do solicitado, ex.: snapshot).
    modelUsed: response.model ?? null,
  };
}

/**
 * Gera um RASCUNHO para o campo "Integração clínica (ATM)" a partir de todos os
 * dados do paciente. Reusa buildAiInsightInput. Não grava nem entra no relatório:
 * o terapeuta revisa e edita antes de salvar. Erros voltam como { error } (pt-BR).
 * Nível INTERNO: `clinicLocale` = idioma da clínica/UI (default pt-BR).
 */
export async function suggestAtmIntegration(
  patientId: string,
  clinicLocale?: string | null,
): Promise<{ suggestion: string } | { error: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { error: "IA não configurada (OPENAI_API_KEY ausente)." };
  }
  const snapshot = await buildAiInsightInput(patientId);
  if (!snapshot) {
    return { error: "Sem dados suficientes do paciente para sugerir." };
  }
  const pack = await resolveClinicalPack(snapshot.patient.clinic_id);
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = reportModel();
    const response = await client.chat.completions.create({
      store: false, // PHI: nao reter a conversa no provedor (defesa em profundidade; BAA e o controle primario)
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: pack.assistantPrompts.atm(clinicLocale) },
        {
          role: "user",
          content: JSON.stringify({
            task: "Rascunho de Integração clínica (ATM). Sem diagnóstico, linguagem prudente.",
            input_data: snapshot,
          }),
        },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) return { error: "A IA não retornou conteúdo. Tente novamente." };
    return { suggestion: text };
  } catch {
    return { error: "Não foi possível gerar a sugestão agora. Tente novamente." };
  }
}

// ── Rascunho do Painel de Direção (queixa + resumo do caso) ───────────────────

/**
 * Gera um RASCUNHO de direção do caso (queixa principal + resumo) a partir do
 * snapshot. Molde do suggestAtmIntegration. NÃO grava: o terapeuta revisa e salva.
 * SEMPRE resolve para { chief, summary } (fallback determinístico sem LLM ou em
 * erro) para o botão nunca quebrar. Nível INTERNO: `clinicLocale` = idioma da UI.
 */
export async function suggestCaseSummary(
  snapshot: AiInsightInputSnapshot,
  clinicLocale?: string | null,
): Promise<CaseSummaryDraft> {
  const fallback = () => buildCaseSummaryFallback(snapshot, clinicLocale);
  if (!process.env.OPENAI_API_KEY) return fallback();
  const pack = await resolveClinicalPack(snapshot.patient.clinic_id);
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = reportModel();
    const response = await client.chat.completions.create({
      store: false, // PHI: nao reter a conversa no provedor (defesa em profundidade; BAA e o controle primario)
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: pack.assistantPrompts.caseSummary(clinicLocale) },
        {
          role: "user",
          content: JSON.stringify({
            task: "Rascunho de direção do caso: chief (1 linha) + summary (parágrafo curto). Sem diagnóstico, linguagem prudente.",
            input_data: snapshot,
          }),
        },
      ],
    });
    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return fallback();
    let parsed: { chief?: unknown; summary?: unknown } = {};
    try { parsed = JSON.parse(raw); } catch { return fallback(); }
    const chief = typeof parsed.chief === "string" ? stripDash(parsed.chief) : "";
    const summary = typeof parsed.summary === "string" ? stripDash(parsed.summary) : "";
    // Se a IA vier vazia, cai no determinístico (nunca devolve rascunho inútil).
    if (!chief && !summary) return fallback();
    return { chief, summary };
  } catch {
    return fallback();
  }
}

/**
 * Escriba clínico (Fase 2): a partir da TRANSCRIÇÃO da consulta, gera um RASCUNHO
 * de "Integração clínica (ATM)" classificado na espinha ATM + eixos Bio³. Reusa
 * buildAiInsightInput e injeta a transcrição como fonte principal. Não grava: o
 * chamador funde no campo com o marcador [Sugestão IA (revise)] e o terapeuta revisa.
 * Nível INTERNO: `clinicLocale` = idioma da clínica/UI.
 */
export async function suggestScribeAtm(
  patientId: string,
  transcript: string,
  clinicLocale?: string | null,
): Promise<{ suggestion: string } | { error: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { error: "IA não configurada (OPENAI_API_KEY ausente)." };
  }
  const clean = (transcript ?? "").trim();
  if (clean.length < 20) {
    return { error: "Transcrição muito curta para gerar rascunho." };
  }
  const snapshot = await buildAiInsightInput(patientId);
  const pack = await resolveClinicalPack(snapshot?.patient.clinic_id ?? null);
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const response = await client.chat.completions.create({
      store: false, // PHI: nao reter a conversa no provedor (defesa em profundidade; BAA e o controle primario)
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: pack.assistantPrompts.scribe(clinicLocale) },
        {
          role: "user",
          content: JSON.stringify({
            task: "Organize a transcrição da consulta na espinha ATM e nos eixos Bio³. Rascunho, sem diagnóstico, linguagem prudente.",
            consultation_transcript: clean.slice(0, 12000),
            patient_context: snapshot ?? null,
          }),
        },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) return { error: "A IA não retornou conteúdo. Tente novamente." };
    return { suggestion: text };
  } catch {
    return { error: "Não foi possível gerar o rascunho agora. Tente novamente." };
  }
}
