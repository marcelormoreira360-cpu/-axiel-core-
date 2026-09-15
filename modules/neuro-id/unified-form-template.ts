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
  | "info"      // cabeçalho/explicação, sem entrada
  | "crisis";   // item de ideação: NÃO pontua, dispara encaminhamento estático

export type UnifiedQuestion = {
  code: string;
  label: string;
  type: UnifiedQuestionType;
  max?: number;
  options?: string[];
  /** âncoras descritivas por nível (humor 0/2/4/6). */
  anchors?: Record<number, string>;
  /** rótulo por opção de escala (índice = valor), ex.: frequência 0–3. */
  scaleLabels?: string[];
  /** aparece só se este código (porta) estiver satisfeito. */
  conditionalOn?: string;
  /** valor/opção da porta que revela esta pergunta (ex.: "Olhos", "Sim"). */
  showIfValue?: string;
  /** escala normal que TAMBÉM mostra a caixa de apoio em crise quando valor ≥ 1
   *  (usado no item 9 do PHQ-9: pontua o total oficial e dispara o encaminhamento). */
  crisisIfPositive?: boolean;
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

// Escala de GRAVIDADE GERAL 0–4 do Mapa Bio³ (`bio3_severity`), para sintomas
// físicos/biofuncionais (decisão híbrida de Marcelo, 14/09/2026). Substitui o
// antigo freq×impacto: uma pergunta só, sem impacto condicional. Motivo: no modelo
// antigo, marcar o sintoma (freq≥1) e não responder o impacto descartava o item
// (virava `null`), zerando o pilar em silêncio. Com escala única, "presente"
// sempre pontua. O emocional (be_*) segue com suas escalas próprias (humor 0–6 e
// ansiedade/regulação 0–3).
//
// IMPORTANTE: esta é uma escala PROPRIETÁRIA do Mapa Bio³, que combina frequência
// e impacto numa única nota de gravidade. NÃO reproduz a matriz freq×severidade do
// QRM e NÃO deve ser apresentada/comparada como "escore QRM".
const SEV_LABELS = ["Ausente", "Leve", "Moderado", "Intenso", "Muito intenso"];

// Instrução dos blocos de sintoma: deixa explícito que a nota é gravidade geral
// (frequência + impacto juntos), evitando a confusão entre frequência e intensidade.
const SEV_INTRO = "Considerando a frequência e o quanto atrapalhou nos últimos 30 dias, marque a gravidade geral de cada sintoma.";

// helper compacto para item de sintoma físico/biofuncional (gravidade 0–4)
const s = (code: string, label: string): UnifiedQuestion =>
  ({ code, label, type: "scale", max: 4, scaleLabels: SEV_LABELS });

// escala de frequência 0–3 (ansiedade/regulação e itens simples), com rótulos.
const FREQ3 = ["Nunca", "Poucos dias", "Mais da metade dos dias", "Quase todos os dias"];
const af = (code: string, label: string): UnifiedQuestion =>
  ({ code, label, type: "scale", max: 3, scaleLabels: FREQ3 });

// Escala de resposta OFICIAL do PHQ-9/GAD-7 (0–3, últimas 2 semanas).
const PHQ_LABELS = ["Nenhuma vez", "Vários dias", "Mais da metade dos dias", "Quase todo dia"];
const q3 = (code: string, label: string): UnifiedQuestion =>
  ({ code, label, type: "scale", max: 3, scaleLabels: PHQ_LABELS });
const PHQ_GAD_INTRO =
  "Nas ÚLTIMAS 2 SEMANAS, com que frequência você foi incomodado(a) por:";

export const UNIFIED_FORM: UnifiedFormTemplate = {
  name: "Neuro ID — Perfil Clínico Integrado de 30 Dias",
  recall: "Responda pensando nos últimos 30 dias.",
  disclaimer:
    "Este formulário não é um serviço de emergência e pode não ser revisado em tempo real. Se você ou outra pessoa estiver em perigo imediato, ligue 911 (EUA) ou 192 (Brasil). Para apoio em crise, ligue ou envie mensagem para o 988 (EUA); no Brasil, ligue 188 (CVV) ou converse pelo chat em cvv.org.br.",
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
      intro: SEV_INTRO,
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
      intro: SEV_INTRO,
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
      intro: SEV_INTRO,
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
        { ...s("bf_olhos", "Incômodo nos olhos (ardência, coceira, visão embaçada)"), conditionalOn: "bf_sistemas_extra", showIfValue: "Olhos" },
        { ...s("bf_ouvidos", "Incômodo nos ouvidos (zumbido, dor, coceira)"), conditionalOn: "bf_sistemas_extra", showIfValue: "Ouvidos" },
        { ...s("bf_nariz", "Congestão nasal, sinusite ou espirros frequentes"), conditionalOn: "bf_sistemas_extra", showIfValue: "Nariz/sinusite" },
        { ...s("bf_garganta", "Incômodo na boca/garganta (tosse, pigarro, rouquidão, aftas)"), conditionalOn: "bf_sistemas_extra", showIfValue: "Boca/garganta" },
        { ...s("bf_urinario", "Urgência ou desconforto para urinar"), conditionalOn: "bf_sistemas_extra", showIfValue: "Bexiga/urinário" },
        { ...s("bf_genital", "Coceira, corrimento ou desconforto íntimo"), conditionalOn: "bf_sistemas_extra", showIfValue: "Genital/íntima" },
      ],
    },
    {
      key: "E",
      title: "Sono, energia e cognição",
      intro: SEV_INTRO,
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
        { code: "bf_apneia", label: "Alguém já disse que você ronca alto ou para de respirar dormindo?", type: "scale", max: 3, scaleLabels: FREQ3 },
      ],
    },
    {
      key: "F",
      title: "Como você tem se sentido",
      intro: PHQ_GAD_INTRO,
      pillar: "emocional",
      scored: true,
      questions: [
        // PHQ-9 oficial (depressão, últimas 2 semanas, 0–3). Itens 1–8 pontuam o pilar.
        q3("phq9_1", "Pouco interesse ou pouco prazer em fazer as coisas"),
        q3("phq9_2", "Sentir-se para baixo, deprimido(a) ou sem esperança"),
        q3("phq9_3", "Dificuldade para dormir, sono agitado ou dormir demais"),
        q3("phq9_4", "Sentir-se cansado(a) ou com pouca energia"),
        q3("phq9_5", "Falta de apetite ou comer demais"),
        q3("phq9_6", "Sentir-se mal consigo mesmo(a), um fracasso, ou que decepcionou a si ou à família"),
        q3("phq9_7", "Dificuldade de se concentrar (ler, ver TV)"),
        q3("phq9_8", "Lentidão para se mover/falar, ou o contrário, muito agitado(a), a ponto de outros notarem"),
        // Item 9 (ideação): pontua o total oficial e dispara o encaminhamento (não entra no pilar).
        { ...q3("phq9_9", "Pensar que seria melhor estar morto(a) ou em se machucar de algum jeito"), crisisIfPositive: true, note: "Dispara o encaminhamento de apoio." },
        // GAD-7 oficial (ansiedade, últimas 2 semanas, 0–3). Os 7 pontuam o pilar.
        { code: "gad7_intro", label: "Ainda nas últimas 2 semanas, com que frequência:", type: "info" },
        q3("gad7_1", "Sentir-se nervoso(a), ansioso(a) ou no limite"),
        q3("gad7_2", "Não conseguir parar ou controlar as preocupações"),
        q3("gad7_3", "Preocupar-se demais com coisas diferentes"),
        q3("gad7_4", "Dificuldade para relaxar"),
        q3("gad7_5", "Ficar tão inquieto(a) que é difícil ficar parado(a)"),
        q3("gad7_6", "Ficar facilmente irritado(a) ou aborrecido(a)"),
        q3("gad7_7", "Sentir medo, como se algo terrível fosse acontecer"),
        // Complemento Bio³ (não faz parte do escore oficial; soma ao pilar). Só o que
        // ACRESCENTA além do PHQ-9/GAD-7 (irritabilidade já é GAD-7 nº6; culpa ≈ PHQ-9 nº6).
        { code: "be_reg_intro", label: "Por fim, ainda nas últimas 2 semanas:", type: "info" },
        q3("be_reg_hipervigilancia", "Sentir-se em alerta constante, sem conseguir baixar a guarda"),
        q3("be_reg_recuperar_estresse", "Dificuldade de voltar ao normal depois de um estresse"),
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
        { code: "med_lista", label: "Liste cada medicamento, dose e frequência.", type: "text", conditionalOn: "med_usa", showIfValue: "Sim" },
        { code: "med_suplementos", label: "Toma suplementos, vitaminas ou fitoterápicos? Quais?", type: "text" },
        { code: "med_efeitos_adversos_freq", label: "Sente efeitos colaterais dos seus remédios?", type: "scale", max: 3, scaleLabels: FREQ3 },
        { code: "med_adesao_dificuldade_freq", label: "Tem dificuldade de tomar certinho (esquece, atrasa, para)?", type: "scale", max: 3, scaleLabels: FREQ3 },
        { code: "med_mudanca_recente", label: "Mudou algum medicamento nos últimos 30 dias?", type: "yes_no" },
      ],
    },
  ],
};

export { FREQ_LABELS, IMP_LABELS, SEV_LABELS };
