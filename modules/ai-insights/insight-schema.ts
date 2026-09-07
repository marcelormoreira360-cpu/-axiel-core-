import { AI_INSIGHT_LABEL } from "@/modules/ai-insights/guardrails";
import { coerceFormatoAtendimento, coerceSuplementacaoStage } from "@/modules/ai-insights/neuro-enums";
import type {
  AiInsightOutput,
  NeuroIdentificacao,
  NeuroLeituraBioemocional,
  NeuroMapaIntegrativo,
  NeuroPlanoRegulacao,
  NeuroProtocoloSuplementacao,
  NeuroRelatorioHipersensibilidade,
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

  // ── DOCUMENTO 2 — Protocolo de Suplementação (rascunho; exige aprovação humana) ──
  // País decide a saída (input_data.supplement_context):
  //  • BR (br_formula): preencha intro + cuidados + FORMULAS (fórmulas manipuladas
  //    agrupadas, prontas para a farmácia) + proximos_passos. itens pode ficar vazio.
  //  • US (us_link): preencha itens (nome/forma/como tomar, sem marca); cuidados/formulas vazios.
  protocolo_suplementacao: {
    // EUA: lista de suplementos (o link é do profissional).
    itens: [
      {
        nome: "Nome do suplemento/ativo (sem marca)",
        objetivo: "Objetivo da sugestão",
        dose_sugerida: "Dose sugerida (rascunho)",
        forma: "Forma (ex.: cápsula, pó, sublingual)",
        como_tomar: "Como/quando tomar (ex.: 1x ao dia pela manhã, com alimento)",
        observacao: "Observação para o profissional validar",
      },
    ],
    // BRASIL (fórmula manipulada) — formato rico, específico do caso:
    intro: "1–2 frases calorosas: este é o plano de suplementação, montado a partir da avaliação e do exame; cuidar primeiro do que o corpo pede.",
    cuidados: [
      { titulo: "Tema do cuidado (ex.: 'Seu intestino', 'Apoio ao fígado', 'Pele, cabelo e articulações')", texto: "Ligue o achado REAL do paciente (exame/avaliação) ao porquê, em linguagem calorosa e específica — nada genérico." },
    ],
    formulas: [
      {
        nome: "Fórmula N · Nome funcional (ex.: 'Fórmula 1 · Probiótico (equilíbrio intestinal)')",
        composicao: [{ ativo: "Ativo (ex.: Magnésio glicinato)", quantidade: "Quantidade exata (ex.: 200 mg / 10 bilhões UFC / 3 a 5 g)" }],
        excipiente: "Excipiente q.s.p. 1 cápsula/sachê (a forma manipulada).",
        posologia: "Como e quando tomar (ex.: '1 cápsula ao dia à noite, longe de bebidas quentes').",
        duracao: "Duração (ex.: '60 dias').",
      },
    ],
    proximos_passos: "Reavaliar em 15/30/60 dias; começar com calma e avisar se algo não cair bem.",
    observacoes_gerais: ["Fórmula para manipulação — a ser avaliada/ajustada pelo profissional e preparada em farmácia de manipulação."],
  },

  // ── DOCUMENTO 3 — Relatório Integrativo de Hipersensibilidade (SÓ com teste capilar) ──
  // Preencher APENAS se houver, em input_data.functional_exams, um exame do tipo
  // "teste_capilar" (ou hipersensibilidade) com dados de reatividade. Se não houver,
  // OMITA este campo por completo (não invente reatividades). NÃO traz suplemento
  // próprio — a suplementação fica só no Documento 2. Estrutura = modelo IFWC.
  relatorio_hipersensibilidade: {
    introducao: "1 a 2 frases: este relatório reúne, em linguagem simples, o que o exame de cabelo mostrou e o que fazer com isso, junto da avaliação e do acompanhamento.",
    visao_geral: {
      importante: "Aviso: a biorressonância é exame complementar e qualitativo — sinaliza itens fora da faixa, mas não os quantifica nem substitui exames laboratoriais ou avaliação médica. Os achados são sinalizações a correlacionar clinicamente.",
      quadro: "Retrato do caso em 3–5 frases: perfil do paciente (idade/foco) + o que o exame de cabelo ACRESCENTA ao Documento 1 (padrão de reatividade e o que ele pode estar associado).",
      principais_achados: "Frase começando 'Os principais achados se concentram em:' listando os grupos de maior reatividade e as sinalizações relevantes (metais, aditivos, nutrientes/hormônios fora da faixa).",
      prioridade_funcional: "Frase 'Prioridade funcional:' — o que reduzir/apoiar (carga inflamatória e química) para apoiar o SNA e a recuperação.",
    },
    padroes: [
      { padrao: "Nome do padrão Neuro ID (ex.: 'Disfunção intestino-cérebro', 'Inflamatório / carga hepática', 'Sensibilidade alimentar cumulativa', 'Carga ambiental / dérmica', 'Eixo tireoidiano-metabólico', 'Predomínio simpático / recuperação autonômica')", interpretacao: "Interpretação funcional prudente ligando os achados do exame ao padrão." },
    ],
    achados_prioritarios: [
      { area: "Área (ex.: 'Alimentos - alta reatividade', 'Alimentos - moderada reatividade', 'Vegan / plant-based', 'Aditivos', 'Metais', 'Nutrientes', 'Microbiota', 'Digestão', 'Hormonal / Tireoide', 'Anti-aging', 'Pele / ambiente', 'Não-alimentar')", achados: "Os achados reais do exame nessa área, nomeados.", prioridade: "A conduta sugerida (ex.: 'eliminar por ~8 semanas', 'evitar ultraprocessados', 'encaminhar para avaliação médica')." },
    ],
    retirada_alta: [
      { grupo: "Grupo (ex.: 'Lácteos e derivados', 'Cereais com glúten e fermentados', 'Bebidas alcoólicas e fermentadas', 'Coco', 'Leguminosas/sementes/oleaginosas', 'Proteínas animais específicas', 'Cogumelos', 'Frutas/condimentos/outros')", itens: "Todos os itens de ALTA reatividade desse grupo, por extenso, separados por vírgula." },
    ],
    retirada_moderada: "Itens de reatividade MODERADA a evitar/reduzir na fase inicial (nomeados), sobretudo se somados no mesmo dia.",
    relacao_sistema_nervoso: "Parágrafo Neuro ID: primeiro regula-se o corpo; como a carga inflamatória/química e a sensibilidade ampla podem manter o SNA em defesa, dialogando com o Documento 2. Linguagem de hipótese funcional a acompanhar.",
    eixos: [
      { titulo: "Eixo (ex.: 'Eixo intestino-cérebro', 'Eixo fígado-detoxificação', 'Eixo tireoidiano-SNA')", descricao: "Como esse eixo aparece nos achados e o que fazer." },
    ],
    fases: [
      { titulo: "Fase (ex.: '1. Eliminação estruturada', '2. Detox e modulação intestinal', '3. Substituição inteligente', '4. Reintrodução')", descricao: "Conduta prática e prudente da fase (o que fazer, por quanto tempo, o que observar)." },
    ],
    plano_alimentar: ["Orientações práticas do dia a dia (comida de verdade, substituições, evitar ultraprocessados/códigos E), em bullets curtos."],
    implicacoes_suplementacao: {
      texto: "As fórmulas, doses e o protocolo completo estão no Documento 2 - Suplementação. Aqui ficam só as implicações do exame de cabelo e os pontos de atenção para essa integração.",
      apoiar: [{ titulo: "O que apoiar (ex.: 'Microbiota', 'Barreira/mucosa intestinal', 'Colágeno', 'Antocianidinas/polifenóis')", descricao: "Por que o exame sugere apoiar, sem citar marca (detalhe no Documento 2)." }],
      pontos_atencao: [{ titulo: "Ponto de atenção (ex.: 'Whey/lácteos', 'Não duplicar')", descricao: "O cuidado na correlação com o protocolo atual." }],
    },
    monitoramento: ["Reavaliar em 15/30/60 dias (intestino, energia, sono, pele, humor, resposta aos alimentos).", "Reintroduzir os alimentos um a um só após a fase de pausa, observando a resposta."],
    resumo_executivo: "Parágrafo 'Prioridade das próximas 8 semanas:' — o que retirar e o que apoiar, mantendo o que já funciona, em tom caloroso e de parceria.",
    observacoes_gerais: ["Aviso: reatividade não é alergia nem diagnóstico; não substitui avaliação médica. A suplementação, quando houver, está no Documento 2."],
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
        forma: str(it?.forma) || undefined,
        como_tomar: str(it?.como_tomar) || undefined,
        // buy_url é preenchido pelo profissional (editor/catálogo), NUNCA pela IA.
        // Por isso não copiamos it.buy_url da saída do modelo.
        observacao: str(it?.observacao),
      })).filter((it: { nome: string }) => it.nome.length > 0)
    : [];
  // Brasil (fórmula manipulada): cuidados + fórmulas agrupadas.
  const cuidados = Array.isArray(s.cuidados)
    ? s.cuidados.slice(0, 12).map((c: any) => ({ titulo: str(c?.titulo), texto: str(c?.texto) }))
        .filter((c: { titulo: string; texto: string }) => c.titulo.length > 0 || c.texto.length > 0)
    : undefined;
  const formulas = Array.isArray(s.formulas)
    ? s.formulas.slice(0, 15).map((f: any) => ({
        nome: str(f?.nome),
        composicao: Array.isArray(f?.composicao)
          ? f.composicao.slice(0, 30).map((c: any) => ({ ativo: str(c?.ativo), quantidade: str(c?.quantidade) }))
              .filter((c: { ativo: string }) => c.ativo.length > 0)
          : [],
        excipiente: str(f?.excipiente) || undefined,
        posologia: str(f?.posologia) || undefined,
        duracao: str(f?.duracao) || undefined,
      })).filter((f: { nome: string; composicao: unknown[] }) => f.nome.length > 0 || f.composicao.length > 0)
    : undefined;
  return {
    itens,
    observacoes_gerais: list(s.observacoes_gerais),
    intro: str(s.intro) || undefined,
    cuidados: cuidados && cuidados.length > 0 ? cuidados : undefined,
    formulas: formulas && formulas.length > 0 ? formulas : undefined,
    proximos_passos: str(s.proximos_passos) || undefined,
  };
}

/** Tabela genérica de 2 colunas (padrão/interpretação, eixo/descrição, etc.). */
function coercePairRows(v: unknown, k1: string, k2: string, max = 12): Array<Record<string, string>> {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max)
    .map((r: any) => ({ [k1]: str(r?.[k1]), [k2]: str(r?.[k2]) }))
    .filter((r) => r[k1].length > 0 || r[k2].length > 0);
}

function coerceHipersensibilidade(o: any): NeuroRelatorioHipersensibilidade | undefined {
  const h = o?.relatorio_hipersensibilidade;
  if (!h || typeof h !== "object") return undefined;

  const vg = h.visao_geral && typeof h.visao_geral === "object" ? h.visao_geral : null;
  const visao_geral = vg
    ? {
        importante: str(vg.importante) || undefined,
        quadro: str(vg.quadro) || undefined,
        principais_achados: str(vg.principais_achados) || undefined,
        prioridade_funcional: str(vg.prioridade_funcional) || undefined,
      }
    : undefined;

  const achados_prioritarios = Array.isArray(h.achados_prioritarios)
    ? h.achados_prioritarios.slice(0, 20).map((r: any) => ({ area: str(r?.area), achados: str(r?.achados), prioridade: str(r?.prioridade) }))
        .filter((r: { area: string; achados: string }) => r.area.length > 0 || r.achados.length > 0)
    : [];

  const retirada_alta = Array.isArray(h.retirada_alta)
    ? h.retirada_alta.slice(0, 30).map((r: any) => ({ grupo: str(r?.grupo), itens: str(r?.itens) }))
        .filter((r: { grupo: string; itens: string }) => r.grupo.length > 0 || r.itens.length > 0)
    : [];

  const isup = h.implicacoes_suplementacao && typeof h.implicacoes_suplementacao === "object" ? h.implicacoes_suplementacao : null;
  const implicacoes_suplementacao = isup
    ? {
        texto: str(isup.texto) || undefined,
        apoiar: coercePairRows(isup.apoiar, "titulo", "descricao", 12) as Array<{ titulo: string; descricao: string }>,
        pontos_atencao: coercePairRows(isup.pontos_atencao, "titulo", "descricao", 12) as Array<{ titulo: string; descricao: string }>,
      }
    : undefined;

  const rel: NeuroRelatorioHipersensibilidade = {
    introducao: str(h.introducao) || undefined,
    visao_geral,
    padroes: coercePairRows(h.padroes, "padrao", "interpretacao", 12) as Array<{ padrao: string; interpretacao: string }>,
    achados_prioritarios,
    retirada_alta,
    retirada_moderada: str(h.retirada_moderada) || undefined,
    relacao_sistema_nervoso: str(h.relacao_sistema_nervoso) || undefined,
    eixos: coercePairRows(h.eixos, "titulo", "descricao", 8) as Array<{ titulo: string; descricao: string }>,
    fases: coercePairRows(h.fases, "titulo", "descricao", 8) as Array<{ titulo: string; descricao: string }>,
    plano_alimentar: list(h.plano_alimentar, 20),
    implicacoes_suplementacao,
    monitoramento: list(h.monitoramento, 12),
    resumo_executivo: str(h.resumo_executivo) || undefined,
    observacoes_gerais: list(h.observacoes_gerais),
  };
  // Só é documento se houver uma seção SUBSTANTIVA (mesma régua de review-card/delivery,
  // que decidem se dá para enviar). Evita Doc 3 "preview-only" (só visão geral/resumo)
  // que aparece mas nunca pode ser enviado.
  const hasContent = rel.achados_prioritarios.length > 0 || rel.retirada_alta.length > 0
    || rel.padroes.length > 0 || rel.fases.length > 0;
  return hasContent ? rel : undefined;
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
    relatorio_hipersensibilidade: coerceHipersensibilidade(object),
  };
}
