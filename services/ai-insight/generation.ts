import OpenAI from "openai";
import type { AiInsightOutput } from "@/lib/types";
import { AI_INSIGHT_SYSTEM_PROMPT } from "@/modules/ai-insights/guardrails";
import { aiInsightJsonShape, coerceAiInsightOutput } from "@/modules/ai-insights/insight-schema";
import { ATM_SUGGESTION_SYSTEM_PROMPT } from "@/services/ai-insight/prompts";
import { buildAiInsightInput, type AiInsightInputSnapshot } from "@/services/ai-insight/input-builder";

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

export async function generateAiInsightOutput(input: AiInsightInputSnapshot): Promise<{ output: AiInsightOutput; tokensUsed?: number | null }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env.local before generating insights.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: AI_INSIGHT_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate structured insights only. No diagnosis. No session. No prescriptions.",
          required_output_shape: aiInsightJsonShape,
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

  return {
    output: coerceAiInsightOutput(parsed),
    tokensUsed: response.usage?.total_tokens ?? null,
  };
}

/**
 * Gera um RASCUNHO para o campo "Integração clínica (ATM)" a partir de todos os
 * dados do paciente. Reusa buildAiInsightInput. Não grava nem entra no relatório:
 * o terapeuta revisa e edita antes de salvar. Erros voltam como { error } (pt-BR).
 */
export async function suggestAtmIntegration(
  patientId: string,
): Promise<{ suggestion: string } | { error: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { error: "IA não configurada (OPENAI_API_KEY ausente)." };
  }
  const snapshot = await buildAiInsightInput(patientId);
  if (!snapshot) {
    return { error: "Sem dados suficientes do paciente para sugerir." };
  }
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const response = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: ATM_SUGGESTION_SYSTEM_PROMPT },
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
