/**
 * case-summary.ts — composição PURA do rascunho de direção do caso.
 *
 * Fallback determinístico (SEM LLM) para o auto-rascunho do Painel de Direção
 * (Melhoria 1). Sem imports pesados (só o TIPO do snapshot, apagado em runtime),
 * para ser testável de forma isolada. A chamada de LLM vive em generation.ts.
 */
import type { AiInsightInputSnapshot } from "@/services/ai-insight/input-builder";

export type CaseSummaryDraft = { chief: string; summary: string };

const isPt = (locale?: string | null) => (locale ?? "pt-BR").toLowerCase().startsWith("pt");

function pillarLabel(pillar: string | null): string {
  if (pillar === "fisico") return "Biomecânico";
  if (pillar === "bioquimico") return "Bioquímico";
  if (pillar === "emocional") return "Bioemocional";
  return pillar ?? "";
}

// Remove travessão e normaliza espaços de qualquer texto ecoado (dado do paciente/IA).
export const stripDash = (s: string) => s.replace(/\s*—\s*/g, ", ").replace(/\s+/g, " ").trim();

function firstChunk(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  const cut = oneLine.split(/(?<=[.!?;])\s/)[0] ?? oneLine;
  const base = cut.length > 0 && cut.length <= max ? cut : oneLine.slice(0, max);
  return stripDash(base).replace(/[.;,\s]+$/, "");
}

const extraByLabel = (snapshot: AiInsightInputSnapshot, kw: string): string | null => {
  const hit = snapshot.patient.assessment_extra.find((e) => e.label.toLowerCase().includes(kw));
  const v = hit?.value?.trim();
  return v && v.length > 0 ? v : null;
};

/**
 * Monta chief + summary a partir do snapshot, para o botão nunca quebrar quando a
 * IA está ausente ou falha. Prioriza objetivo, anamnese e integração ATM; agrega
 * eixo prioritário do Neuro ID e medicamentos em uso. Linguagem prudente.
 */
export function buildCaseSummaryFallback(snapshot: AiInsightInputSnapshot, locale?: string | null): CaseSummaryDraft {
  const pt = isPt(locale);
  const objetivo = extraByLabel(snapshot, "objetivo");
  const integracao = extraByLabel(snapshot, "integ");
  const anamnese = snapshot.patient.anamnese?.trim() || null;

  const chief = firstChunk(objetivo ?? anamnese ?? "");

  const parts: string[] = [];
  if (objetivo) parts.push(pt ? `Objetivos do paciente: ${stripDash(objetivo)}.` : `Patient goals: ${stripDash(objetivo)}.`);
  if (anamnese) parts.push(stripDash(anamnese));
  if (integracao) parts.push(stripDash(integracao));

  const neuro = snapshot.neuro_id;
  if (neuro?.priority_pillar) {
    const idx = neuro.indice_geral != null ? (pt ? `, índice geral ${Math.round(neuro.indice_geral)}%` : `, overall index ${Math.round(neuro.indice_geral)}%`) : "";
    const partial = neuro.is_partial ? (pt ? " (leitura parcial)" : " (partial reading)") : "";
    parts.push(pt
      ? `Mapa Neuro ID sugere foco no eixo ${pillarLabel(neuro.priority_pillar)}${idx}${partial}.`
      : `Neuro ID map suggests focusing on the ${pillarLabel(neuro.priority_pillar)} axis${idx}${partial}.`);
  }

  const meds = snapshot.prescriptions.filter((p) => p.type === "medication" && p.active).map((p) => p.name).filter(Boolean);
  if (meds.length > 0) {
    parts.push(pt
      ? `Medicamentos em uso: ${meds.join(", ")}, verificar interações.`
      : `Medications in use: ${meds.join(", ")}, check interactions.`);
  }

  return { chief, summary: stripDash(parts.join(" ")) };
}
