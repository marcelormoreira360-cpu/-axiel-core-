import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import type { AiInsightOutput, NeuroMapaIntegrativo, NeuroPlanoRegulacao, NeuroProtocoloSuplementacao } from "@/lib/types";

function list(v: unknown, max = 12): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : [];
}

export const aiInsightJsonShape = {
  label: AI_INSIGHT_LABEL,
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
  safety_note: "AI-generated insights (not medical advice). This does not diagnose, treat, prescribe, or replace professional clinical judgment.",
  // ── Documento 1 — Mapa Integrativo Neuro ID 360 ("o que foi identificado") ──
  mapa_integrativo: {
    principais_achados: ["Principal achado do atendimento."],
    padroes_observados: ["Padrão observado nos dados."],
    leitura_integrativa: "Leitura integrativa do caso, conectando os achados.",
    achados_funcionais: ["Achado funcional (questionários, neurometria, biorressonância)."],
    elementos_biomecanicos: ["Elemento biomecânico observado."],
    elementos_bioemocionais: ["Elemento bioemocional observado."],
    desregulacao_sna: ["Sinal de desregulação do sistema nervoso autônomo."],
    fatores_bioquimicos: ["Possível fator bioquímico envolvido (com base em exames)."],
    prioridades_atencao: ["Prioridade de atenção."],
  },
  // ── Documento 2 — Plano Inicial de Regulação ("o que fazer agora", rascunho) ──
  plano_regulacao: {
    proximos_passos: ["Próximo passo sugerido (rascunho para o profissional validar)."],
    orientacoes_iniciais: ["Orientação inicial."],
    recomendacoes_rotina: ["Recomendação de rotina."],
    sugestoes_regulacao: ["Sugestão de regulação."],
    exames_complementares: ["Exame complementar recomendado."],
    prioridades: ["Prioridade do plano."],
    recomendacao_continuidade: "Recomendação de continuidade do acompanhamento.",
  },
  // ── Documento 3 — Protocolo de Suplementação (rascunho; exige aprovação humana) ──
  protocolo_suplementacao: {
    itens: [
      { nome: "Nome do suplemento", objetivo: "Objetivo da sugestão", dose_sugerida: "Dose sugerida (rascunho)", observacao: "Observação para o profissional validar" },
    ],
    observacoes_gerais: ["Observação geral sobre a suplementação (rascunho para validação profissional)."],
  },
} satisfies AiInsightOutput;

function coerceMapa(o: any): NeuroMapaIntegrativo | undefined {
  const m = o?.mapa_integrativo;
  if (!m || typeof m !== "object") return undefined;
  return {
    principais_achados: list(m.principais_achados),
    padroes_observados: list(m.padroes_observados),
    leitura_integrativa: String(m.leitura_integrativa ?? "").trim(),
    achados_funcionais: list(m.achados_funcionais),
    elementos_biomecanicos: list(m.elementos_biomecanicos),
    elementos_bioemocionais: list(m.elementos_bioemocionais),
    desregulacao_sna: list(m.desregulacao_sna),
    fatores_bioquimicos: list(m.fatores_bioquimicos),
    prioridades_atencao: list(m.prioridades_atencao),
  };
}

function coercePlano(o: any): NeuroPlanoRegulacao | undefined {
  const p = o?.plano_regulacao;
  if (!p || typeof p !== "object") return undefined;
  return {
    proximos_passos: list(p.proximos_passos),
    orientacoes_iniciais: list(p.orientacoes_iniciais),
    recomendacoes_rotina: list(p.recomendacoes_rotina),
    sugestoes_regulacao: list(p.sugestoes_regulacao),
    exames_complementares: list(p.exames_complementares),
    prioridades: list(p.prioridades),
    recomendacao_continuidade: String(p.recomendacao_continuidade ?? "").trim(),
  };
}

function coerceProtocolo(o: any): NeuroProtocoloSuplementacao | undefined {
  const s = o?.protocolo_suplementacao;
  if (!s || typeof s !== "object") return undefined;
  const itens = Array.isArray(s.itens)
    ? s.itens.slice(0, 20).map((it: any) => ({
        nome: String(it?.nome ?? "").trim(),
        objetivo: String(it?.objetivo ?? "").trim(),
        dose_sugerida: String(it?.dose_sugerida ?? "").trim(),
        observacao: String(it?.observacao ?? "").trim(),
      })).filter((it: { nome: string }) => it.nome.length > 0)
    : [];
  return { itens, observacoes_gerais: list(s.observacoes_gerais) };
}

export function coerceAiInsightOutput(value: unknown): AiInsightOutput {
  const object = typeof value === "object" && value !== null ? (value as Record<string, any>) : {};

  return {
    label: AI_INSIGHT_LABEL,
    structured_summary: {
      overview: String(object.structured_summary?.overview ?? "No summary was generated."),
      key_context: list(object.structured_summary?.key_context, 8),
      current_status: String(object.structured_summary?.current_status ?? "Not enough information to summarize current status."),
    },
    patterns_and_correlations: Array.isArray(object.patterns_and_correlations)
      ? object.patterns_and_correlations.slice(0, 8).map((item: any) => ({
          title: String(item?.title ?? "Observed pattern"),
          insight: String(item?.insight ?? ""),
          related_inputs: list(item?.related_inputs, 5),
        }))
      : [],
    practitioner_review_points: list(object.practitioner_review_points, 10),
    data_limitations: list(object.data_limitations, 10),
    safety_note:
      "AI-generated insights (not medical advice). This does not diagnose, treat, prescribe, or replace professional clinical judgment.",
    mapa_integrativo: coerceMapa(object),
    plano_regulacao: coercePlano(object),
    protocolo_suplementacao: coerceProtocolo(object),
  };
}
