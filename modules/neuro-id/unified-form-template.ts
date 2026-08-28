/**
 * unified-form-template.ts — FORMULÁRIO UNIFICADO Neuro ID (dado, fonte única).
 *
 * Descreve os 8 blocos e as perguntas ao paciente do "Perfil Clínico Integrado
 * de 30 Dias". É a fonte que a UI de preview renderiza e que a camada de seed
 * usará. Os códigos casam com o catálogo (modules/neuro-id/catalog.ts) e com a
 * fiação de import (unified-form-import.ts).
 *
 * USO INTERNO / TESTE. Antes de uso com paciente real: item de ideação só
 * encaminha (não gradua risco), score emocional só interno, disclaimer de
 * "não é serviço de emergência". Ver _BRIEF_NEUROID_FORMULARIO.md.
 */

import type { NeuroPillar } from "./catalog";

export type UnifiedQuestionType =
  | "freqimp"   // duas perguntas: frequência 0–3 + impacto 0–3 (impacto condicional a freq≥1)
  | "scale"     // escala 0..max (humor 6; ansiedade/regulação 3; slider 10)
  | "yes_no"
  | "text"
  | "date"
  | "choice"
  | "multi"
  | "crisis";   // item de ideação: NÃO pontua, dispara encaminhamento estático

export type UnifiedQuestion = {
  code: string;
  label: string;
  type: UnifiedQuestionType;
  max?: number;
  options?: string[];
  /** âncoras descritivas por nível (humor 0/2/4/6). */
  anchors?: Record<number, string>;
  /** aparece só se este código for "sim"/marcado/freq≥1. */
  conditionalOn?: string;
  note?: string;
};

export type UnifiedBlock = {
  key: string;
  title: string;
  intro?: string;
  /** pilar de destino dos itens pontuados do bloco (quando aplicável). */
  pillar?: NeuroPillar;
  scored: boolean;
  questions: UnifiedQuestion[];
};

export type UnifiedFormTemplate = {
  name: string;
  recall: string;
  disclaimer: string;
  blocks: UnifiedBlock[];
};

const FREQ_LABELS = ["Nunca ou quase nunca", "Poucos dias no mês", "Vários dias", "Quase todos os dias"];
const IMP_LABELS = ["Não atrapalha", "Atrapalha um pouco", "Atrapalha bastante", "Atrapalha muito"];

// helper compacto para item de sintoma comum (freq×impacto)
const s = (code: string, label: string): UnifiedQuestion => ({ code, label, type: "freqimp" });

export const UNIFIED_FORM: UnifiedFormTemplate = {
  name: "Neuro ID — Perfil Clínico Integrado de 30 Dias",
  recall: "Responda pensando nos últimos 30 dias.",
  disclaimer:
    "Este formulário não é um serviço de emergência e pode não ser revisado em tempo real. Se você ou outra pessoa estiver em perigo imediato, ligue 911 (EUA) ou 192 (Brasil). Para apoio em crise, ligue ou envie mensagem para 988 (EUA) ou 188 (CVV, Brasil).",
  blocks: [
    {
      key: "A",
      title: "Perfil e segurança",
      intro: "Estas perguntas ajudam a nossa equipe a te conhecer e preparar o seu cuidado.",
      scored: false,
      questions: [
        { code: "a_idioma", label: "Em qual idioma você prefere continuar?", type: "choice", options: ["Português", "English"] },
        { code: "a_data_nascimento", label: "Qual é a sua data de nascimento?", type: "date" },
        { code: "a_objetivo_principal", label: "O que mais te fez procurar a gente agora?", type: "text" },
        { code: "a_gravidez", label: "Você está grávida ou amamentando?", type: "choice", options: ["Não", "Grávida", "Amamentando", "Prefiro não dizer"] },
        { code: "a_implantes", label: "Você usa marca-passo, implante eletrônico ou tem epilepsia?", type: "multi", options: ["Marca-passo/implante", "Epilepsia/convulsões", "Nenhum"] },
        { code: "a_condicao_ativa", label: "Você tem algum diagnóstico ativo importante em acompanhamento?", type: "text" },
        { code: "a_flag_peso", label: "Nos últimos 30 dias, você teve perda de peso sem explicação?", type: "yes_no" },
      ],
    },
    {
      key: "B",
      title: "Corpo e movimento",
      pillar: "fisico",
      scored: true,
      questions: [
        s("bm_dor", "Dor no corpo"),
        { code: "bm_dor_regioes", label: "Onde você mais sente dor?", type: "multi", options: ["Pescoço", "Ombros", "Coluna alta", "Lombar", "Quadril", "Joelhos", "Cabeça", "Difusa", "Não tenho dor"] },
        s("bm_rigidez", "Rigidez ou travamento ao se mover"),
        s("bm_limitacao", "Dificuldade ou limitação para movimentos do dia a dia"),
        s("bm_equilibrio", "Desequilíbrio ou instabilidade ao andar/levantar"),
        s("bm_fraqueza_muscular", "Fraqueza ou cansaço nos músculos"),
      ],
    },
    {
      key: "C",
      title: "Regulação e cardiorrespiratório",
      pillar: "bioquimico",
      scored: true,
      questions: [
        s("bf_palpitacoes", "Coração acelerado, forte ou descompassado em repouso"),
        s("bf_tontura_levantar", "Tontura ou vista escura ao levantar rápido"),
        s("bf_termorregulacao", "Sensibilidade ao calor/frio, calorões ou suores"),
        s("bf_desconforto_toracico", "Aperto ou desconforto no peito sem causa conhecida"),
        s("bf_falta_ar", "Falta de ar sem estar se esforçando"),
        s("bf_respiracao_estresse", "Respiração curta ou presa em momentos de tensão"),
        s("bf_pressao_instavel", "Pressão oscilando (medida ou sintomas)"),
      ],
    },
    {
      key: "D",
      title: "Digestivo, metabólico e sistêmico",
      pillar: "bioquimico",
      scored: true,
      questions: [
        s("bf_refluxo", "Azia, refluxo ou náusea"),
        s("bf_intestino", "Prisão de ventre ou diarreia sem causa clara"),
        s("bf_inchaco", "Inchaço na barriga, gases ou arrotos em excesso"),
        s("bf_dor_abdominal_estresse", "Nó no estômago ou dor na barriga junto com momentos de estresse"),
        s("bf_apetite", "Mudanças no apetite não explicadas pela dieta"),
        s("bf_peso", "Variações de peso difíceis de explicar"),
        s("bf_pele_cabelo", "Queda de cabelo, pele seca ou unhas frágeis"),
        s("bf_infeccoes", "Fica doente com facilidade ou demora a se recuperar"),
        s("bf_hormonal", "Alterações menstruais, de menopausa ou sinais hormonais"),
        { code: "bf_sistemas_extra", label: "Teve incômodo importante em alguma destas áreas?", type: "multi", options: ["Olhos", "Ouvidos", "Nariz/sinusite", "Boca/garganta", "Bexiga/urinário", "Genital/íntima", "Nenhuma"] },
        { ...s("bf_olhos", "Incômodo nos olhos (ardência, coceira, visão embaçada)"), conditionalOn: "bf_sistemas_extra" },
        { ...s("bf_ouvidos", "Incômodo nos ouvidos (zumbido, dor, coceira)"), conditionalOn: "bf_sistemas_extra" },
        { ...s("bf_nariz", "Congestão nasal, sinusite ou espirros frequentes"), conditionalOn: "bf_sistemas_extra" },
        { ...s("bf_garganta", "Incômodo na boca/garganta (tosse, pigarro, rouquidão, aftas)"), conditionalOn: "bf_sistemas_extra" },
        { ...s("bf_urinario", "Urgência ou desconforto para urinar"), conditionalOn: "bf_sistemas_extra" },
        { ...s("bf_genital", "Coceira, corrimento ou desconforto íntimo"), conditionalOn: "bf_sistemas_extra" },
      ],
    },
    {
      key: "E",
      title: "Sono, energia e cognição",
      pillar: "bioquimico",
      scored: true,
      questions: [
        s("bf_sono_iniciar", "Dificuldade para pegar no sono"),
        s("bf_sono_manter", "Acordar várias vezes durante a noite"),
        s("bf_sono_reparador", "Acordar com cansaço mesmo tendo dormido o suficiente"),
        s("bf_sonolencia_dia", "Muito sono durante o dia"),
        s("bf_fadiga", "Cansaço ou falta de energia desproporcional ao esforço"),
        s("bf_recuperacao", "Demora a se recuperar depois de esforço ou estresse"),
        s("bf_concentracao", "Dificuldade de concentração em tarefas simples"),
        s("bf_memoria", "Esquecimentos com mais frequência que o normal"),
        s("bf_brain_fog", "Mente enevoada ou travada para pensar/decidir"),
        { code: "bf_apneia", label: "Alguém já disse que você ronca alto ou para de respirar dormindo?", type: "scale", max: 3 },
      ],
    },
    {
      key: "F",
      title: "Como você tem se sentido",
      intro: "Sobre como você tem se sentido por dentro nos últimos 30 dias. Responda com gentileza consigo.",
      pillar: "emocional",
      scored: true,
      questions: [
        { code: "be_mood_humor", label: "Como tem estado o seu ânimo e a sua disposição?", type: "scale", max: 6, anchors: { 0: "Bem, como de costume", 2: "Um pouco para baixo às vezes", 4: "Para baixo na maior parte dos dias", 6: "Tristeza pesada quase o tempo todo" } },
        { code: "be_mood_tensao", label: "Tem sentido tensão ou aflição por dentro, difícil de relaxar?", type: "scale", max: 6, anchors: { 0: "Tranquilidade", 2: "Inquietação leve às vezes", 4: "Tensão na maioria dos dias", 6: "Aflição quase insuportável" } },
        { code: "be_mood_sono", label: "Como tem sido o seu sono?", type: "scale", max: 6, anchors: { 0: "Durmo bem", 2: "Levemente pior", 4: "Bem pior", 6: "Durmo muito pouco" } },
        { code: "be_mood_apetite", label: "E o seu apetite?", type: "scale", max: 6, anchors: { 0: "Normal", 2: "Um pouco menor", 4: "Bem reduzido", 6: "Quase sem vontade" } },
        { code: "be_mood_concentracao", label: "Consegue se concentrar e reunir os pensamentos?", type: "scale", max: 6, anchors: { 0: "Sem dificuldade", 2: "Custa um pouco", 4: "Difícil na maioria", 6: "Quase não consigo" } },
        { code: "be_mood_iniciativa", label: "Como está a sua energia para começar as coisas?", type: "scale", max: 6, anchors: { 0: "Faço tudo normalmente", 2: "Custa começar", 4: "Preciso me forçar", 6: "Quase não dou o primeiro passo" } },
        { code: "be_mood_envolvimento", label: "Ainda sente interesse e prazer nas coisas de que gosta?", type: "scale", max: 6, anchors: { 0: "Sim, como sempre", 2: "Um pouco menos", 4: "Bem menos", 6: "Perdi o interesse por quase tudo" } },
        { code: "be_mood_pessimismo", label: "Como tem enxergado o futuro e a si?", type: "scale", max: 6, anchors: { 0: "Com esperança", 2: "Às vezes me cobro", 4: "Sensação de fracasso/culpa", 6: "Futuro sem saída, culpa constante" } },
        { code: "be_crisis_gosto_vida", label: "Como está a sua vontade de viver e de seguir em frente?", type: "crisis", max: 6, anchors: { 0: "Aproveito a vida", 2: "Às vezes parece sem graça", 3: "Penso que seria melhor não estar aqui", 4: "Penso que preferiria não acordar", 6: "Tenho pensado em me machucar" }, note: "Item de encaminhamento (não pontua)." },
        { code: "be_anx_nervosismo", label: "Nervosismo, ansiedade ou sensação de estar no limite", type: "scale", max: 3 },
        { code: "be_anx_preocupacao_control", label: "Dificuldade de parar ou controlar as preocupações", type: "scale", max: 3 },
        { code: "be_anx_preocupacao_demais", label: "Preocupação demais com coisas diferentes", type: "scale", max: 3 },
        { code: "be_anx_relaxar", label: "Dificuldade de relaxar", type: "scale", max: 3 },
        { code: "be_anx_inquietacao", label: "Inquietação, difícil ficar parado", type: "scale", max: 3 },
        { code: "be_anx_medo_ruim", label: "Medo de que algo ruim fosse acontecer", type: "scale", max: 3 },
        { code: "be_anx_sobressalto", label: "Assustar-se ou ficar em alerta com facilidade", type: "scale", max: 3 },
        { code: "be_reg_irritabilidade", label: "Perder a paciência ou irritação com facilidade", type: "scale", max: 3 },
        { code: "be_reg_hipervigilancia", label: "Sentir-se em alerta constante, sem baixar a guarda", type: "scale", max: 3 },
        { code: "be_reg_culpa", label: "Culpa ou autocobrança por coisas do dia a dia", type: "scale", max: 3 },
        { code: "be_reg_recuperar_estresse", label: "Dificuldade de voltar ao normal após um estresse", type: "scale", max: 3 },
      ],
    },
    {
      key: "G",
      title: "Para completar o seu quadro (opcional)",
      scored: false,
      questions: [
        { code: "ev_exames_sangue", label: "Você tem exames de sangue recentes? Pode anexar.", type: "yes_no" },
        { code: "ev_exame_cabelo", label: "Já fez exame de cabelo (mineralograma)?", type: "yes_no" },
        { code: "ev_autoimune", label: "Tem diagnóstico autoimune confirmado? Qual?", type: "text" },
        { code: "ev_diagnosticos_previos", label: "Outros diagnósticos ou cirurgias importantes?", type: "text" },
      ],
    },
    {
      key: "H",
      title: "Medicamentos",
      intro: "Índice de complexidade terapêutica (uso do profissional, separado do score).",
      scored: false,
      questions: [
        { code: "med_usa", label: "Você toma algum medicamento contínuo?", type: "yes_no" },
        { code: "med_lista", label: "Liste cada medicamento, dose e frequência.", type: "text", conditionalOn: "med_usa" },
        { code: "med_suplementos", label: "Toma suplementos, vitaminas ou fitoterápicos? Quais?", type: "text" },
        { code: "med_efeitos_adversos_freq", label: "Sente efeitos colaterais dos seus remédios?", type: "scale", max: 3 },
        { code: "med_adesao_dificuldade_freq", label: "Tem dificuldade de tomar certinho (esquece, atrasa, para)?", type: "scale", max: 3 },
        { code: "med_mudanca_recente", label: "Mudou algum medicamento nos últimos 30 dias?", type: "yes_no" },
      ],
    },
  ],
};

export { FREQ_LABELS, IMP_LABELS };
