import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import type {
  AiInsightOutput,
  NeuroIdentificacao,
  NeuroMapaIntegrativo,
  NeuroPlanoRegulacao,
  NeuroProtocoloSuplementacao,
  NeuroSecaoItem,
} from "@/lib/types";

function list(v: unknown, max = 12): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : [];
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function coerceIdentificacao(v: any): NeuroIdentificacao | undefined {
  if (!v || typeof v !== "object") return undefined;
  const id: NeuroIdentificacao = {
    paciente: str(v.paciente) || undefined,
    idade: str(v.idade) || undefined,
    sexo: str(v.sexo) || undefined,
    peso: str(v.peso) || undefined,
    altura: str(v.altura) || undefined,
    local: str(v.local) || undefined,
    data_avaliacoes: str(v.data_avaliacoes) || undefined,
    microfisioterapia: str(v.microfisioterapia) || undefined,
    exame_cabelo: str(v.exame_cabelo) || undefined,
    base_orientacao: str(v.base_orientacao) || undefined,
  };
  return Object.values(id).some(Boolean) ? id : undefined;
}

function coerceSecaoItens(v: unknown, max = 15): NeuroSecaoItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, max)
    .map((it: any) => ({ titulo: str(it?.titulo), descricao: str(it?.descricao) }))
    .filter((it) => it.titulo.length > 0 || it.descricao.length > 0);
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

  // ── DOCUMENTO 1 — RELATÓRIO FUNCIONAL INTEGRADO ("o que foi identificado") ──
  mapa_integrativo: {
    identificacao: {
      paciente: "Nome completo do paciente",
      idade: "Idade (ex.: 37 anos)",
      sexo: "Sexo",
      peso: "Peso, se informado (ex.: 57 kg)",
      altura: "Altura, se informada (ex.: 165 cm)",
      local: "Local de acompanhamento, se informado",
      data_avaliacoes: "Data das avaliações, se informada",
    },
    exames_avaliados:
      "Parágrafo descrevendo os exames e informações considerados (neurometria, vias nervosas, cardiorrespiratório, questionários funcionais, biorressonância, relato clínico). Sem finalidade de diagnóstico médico absoluto.",
    resultados_encontrados: [
      { titulo: "Padrão observado (título curto em negrito)", descricao: "Explicação do achado nos exames + tradução 'na prática' do que isso costuma significar para o paciente." },
    ],
    sintese_clinico_funcional: "Síntese conectando os achados (sobrecarga, pontos de atenção e pontos preservados).",
    conclusao_funcional: "Conclusão em linguagem simples: padrão principal, o que pode causar e o ponto positivo/evolução. Termina indicando a fase da Jornada Neuro ID.",
    fase_jornada: "Nome da fase da Jornada Neuro ID em que o paciente se encontra.",
    observacao: "Este documento não substitui avaliação médica, diagnóstico, exames laboratoriais ou condutas já prescritas.",
  },

  // ── DOCUMENTO 2 — PLANO INTEGRATIVO NEURO ID ("o que fazer agora", rascunho) ──
  plano_regulacao: {
    identificacao: {
      paciente: "Nome do paciente",
      idade: "Idade",
      sexo: "Sexo",
      local: "Local de acompanhamento, se informado",
      microfisioterapia: "Situação da microfisioterapia, se aplicável",
      exame_cabelo: "Situação do exame de cabelo, se aplicável",
      base_orientacao: "Base da orientação (exames funcionais e relatos considerados).",
    },
    fase_jornada_nome: "Nome da fase (ex.: Regulação Inicial e Redução de Sobrecarga).",
    fase_jornada_justificativa: "Por que o paciente está nesta fase e qual o foco do momento.",
    direcao_terapeutica: "Direção terapêutica: eixo principal de atenção e prioridades, conduta simples e progressiva.",
    plano_inicial: [
      { titulo: "Tema do passo (ex.: Sono e higiene do sono)", descricao: "Orientação prática e bem tolerada para este tema." },
    ],
    acompanhamento_evolucao: "Acompanhamento da evolução relatada nas sessões e padrões a observar.",
    proximo_passo: "Próximo passo concreto do acompanhamento.",
    observacao: "Este plano não substitui avaliação médica, exames laboratoriais ou condutas já prescritas.",
  },

  // ── DOCUMENTO 3 — Protocolo de Suplementação (rascunho; exige aprovação humana) ──
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
    identificacao: coerceIdentificacao(m.identificacao),
    exames_avaliados: str(m.exames_avaliados) || undefined,
    resultados_encontrados: coerceSecaoItens(m.resultados_encontrados),
    sintese_clinico_funcional: str(m.sintese_clinico_funcional) || undefined,
    conclusao_funcional: str(m.conclusao_funcional) || undefined,
    fase_jornada: str(m.fase_jornada) || undefined,
    observacao: str(m.observacao) || undefined,
    // fallback antigos
    principais_achados: list(m.principais_achados),
    padroes_observados: list(m.padroes_observados),
    leitura_integrativa: str(m.leitura_integrativa) || undefined,
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
    identificacao: coerceIdentificacao(p.identificacao),
    fase_jornada_nome: str(p.fase_jornada_nome) || undefined,
    fase_jornada_justificativa: str(p.fase_jornada_justificativa) || undefined,
    direcao_terapeutica: str(p.direcao_terapeutica) || undefined,
    plano_inicial: coerceSecaoItens(p.plano_inicial, 20),
    acompanhamento_evolucao: str(p.acompanhamento_evolucao) || undefined,
    proximo_passo: str(p.proximo_passo) || undefined,
    observacao: str(p.observacao) || undefined,
    // fallback antigos
    proximos_passos: list(p.proximos_passos),
    orientacoes_iniciais: list(p.orientacoes_iniciais),
    recomendacoes_rotina: list(p.recomendacoes_rotina),
    sugestoes_regulacao: list(p.sugestoes_regulacao),
    exames_complementares: list(p.exames_complementares),
    prioridades: list(p.prioridades),
    recomendacao_continuidade: str(p.recomendacao_continuidade) || undefined,
  };
}

function coerceProtocolo(o: any): NeuroProtocoloSuplementacao | undefined {
  const s = o?.protocolo_suplementacao;
  if (!s || typeof s !== "object") return undefined;
  const itens = Array.isArray(s.itens)
    ? s.itens.slice(0, 20).map((it: any) => ({
        nome: str(it?.nome),
        objetivo: str(it?.objetivo),
        dose_sugerida: str(it?.dose_sugerida),
        observacao: str(it?.observacao),
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
