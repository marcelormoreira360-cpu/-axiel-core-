import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import { coerceFormatoAtendimento, coerceSuplementacaoStage } from "@/modules/ai-insights/neuro-enums";
import type {
  AiInsightOutput,
  NeuroIdentificacao,
  NeuroLeituraBioemocional,
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

/** Slot dedicado da leitura bioemocional: 3–4 temas macro + síntese qualitativa. */
function coerceLeituraBioemocional(v: any): NeuroLeituraBioemocional | undefined {
  if (!v || typeof v !== "object") return undefined;
  const temas = list(v.temas, 4);
  const sintese = str(v.sintese);
  return temas.length > 0 || sintese.length > 0 ? { temas, sintese } : undefined;
}

/** Doc 2 — os 3 pilares (nervoso / emocional / estilo de vida). */
function coerceTresPilares(v: any): { nervoso: string; emocional: string; estilo_de_vida: string } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const nervoso = str(v.nervoso);
  const emocional = str(v.emocional);
  const estilo_de_vida = str(v.estilo_de_vida);
  return nervoso || emocional || estilo_de_vida ? { nervoso, emocional, estilo_de_vida } : undefined;
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

  // ── DOCUMENTO 1 — RELATÓRIO FUNCIONAL INTEGRADO (Report of Findings, 8 seções persuasivas) ──
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
    abertura_calorosa:
      "2 a 3 frases acolhendo o paciente pelo nome e reconhecendo a coragem de buscar esse cuidado. Sem jargão.",
    leitura_bio3: {
      titulo: "Retrato humano de como o corpo está hoje (ex.: 'Como seu corpo está hoje').",
      descricao:
        "Mapa Bio³ COM os números (índice geral + % de cada pilar, maior = mais sobrecarga), sempre seguidos da tradução em linguagem do dia a dia (qual pilar mais sobrecarregado, qual mais preservado).",
    },
    leitura_neurometrica: [
      {
        titulo: "Achado principal em linguagem humana (ex.: 'Seu ritmo interno está acelerado')",
        descricao:
          "Peso de laudo: achado → dado (valor + faixa de referência ou classificação Normal/Leve/Moderada/Alta/Muito Alta) → o que significa → o que ele sente. 2 a 3 dados reais de metrics, nunca inventados.",
      },
    ],
    leitura_bioemocional: {
      temas: [
        "3 a 4 temas macro com as EMOÇÕES REAIS da avaliação (ex.: 'peso emocional ligado à família', 'autocobrança'), nunca inventadas.",
      ],
      sintese: "1 a 2 frases costurando os temas com cuidado, sem citar exame/órgão/número/diagnóstico.",
    },
    ancora_positiva: "1 a 2 frases sobre um ponto REAL preservado/forte do paciente. Obrigatório em todo relatório.",
    conexao_aha:
      "O momento 'agora faz sentido': conecta os achados entre si e com a queixa, mostrando como corpo, sistema nervoso e emoções conversam.",
    porque_agir_agora:
      "Por que começar agora joga a favor, em tom de oportunidade e possibilidade, nunca de medo.",
    proximo_passo:
      "Convite concreto e simples, em linguagem de parceria; 'sessões terapêuticas de acompanhamento', sem número/protocolo/exame.",
    fase_jornada: "Nome da fase da Jornada Neuro ID em que o paciente se encontra (uso interno/rótulo).",
    observacao: "Este documento não substitui avaliação médica, diagnóstico, exames laboratoriais ou condutas já prescritas.",
  },

  // ── DOCUMENTO 2 — PLANO INTEGRATIVO (Rota A, 4 blocos persuasivos: o que fazer juntos) ──
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
    onde_queremos_chegar: "Aonde vamos juntos, em linguagem de destino e possibilidade (descanso, calma, energia, presença). Sem prometer cura.",
    tres_pilares: {
      nervoso: "Frente do sistema nervoso: acalmar (respiração, regulação, pausas). Uma frase, prática simples.",
      emocional: "Frente emocional: cuidar do que pesa, no seu ritmo, em linguagem de autocuidado (nunca psicoterapia formal nem diagnóstico).",
      estilo_de_vida: "Frente de estilo de vida: sono, movimento e alimentação como apoio do dia a dia.",
    },
    como_caminhar_juntos: "Como o acompanhamento acontece na prática (formato à distância/presencial; encontros como sequência progressiva). 'Sessões terapêuticas de acompanhamento', sem número/protocolo/exame.",
    proximo_passo: "O primeiro passo concreto, em convite ('vamos começar por...').",
    formato_atendimento: "remoto",
    suplementacao_stage: "ponteiro_doc3",
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
    // ── Doc 1 persuasivo (Rota A) — 6 seções (opcionais; LLM pode ainda não preencher) ──
    abertura_calorosa: str(m.abertura_calorosa) || undefined,
    leitura_bio3: coerceSecaoItens([m.leitura_bio3])[0],
    leitura_neurometrica: coerceSecaoItens(m.leitura_neurometrica),
    leitura_bioemocional: coerceLeituraBioemocional(m.leitura_bioemocional),
    ancora_positiva: str(m.ancora_positiva) || undefined,
    conexao_aha: str(m.conexao_aha) || undefined,
    porque_agir_agora: str(m.porque_agir_agora) || undefined,
    proximo_passo: str(m.proximo_passo) || undefined,
    // conduta_emocional / clinical_flags / crisis_hotline_block: RESOLVIDOS NO SERVER
    // (workflow.ts), nunca aqui — o que a LLM mandar nesses campos é descartado.
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
    // ── Doc 2 (Plano Integrativo) — 4 blocos (opcionais) ──
    onde_queremos_chegar: str(p.onde_queremos_chegar) || undefined,
    tres_pilares: coerceTresPilares(p.tres_pilares),
    como_caminhar_juntos: str(p.como_caminhar_juntos) || undefined,
    formato_atendimento: coerceFormatoAtendimento(p.formato_atendimento),
    suplementacao_stage: coerceSuplementacaoStage(p.suplementacao_stage),
    // conduta_emocional: RESOLVIDO NO SERVER (workflow.ts), descartado aqui.
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
