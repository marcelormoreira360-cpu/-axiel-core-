import type { IntakeQuestionType } from "@/lib/types";

// Modelos prontos de anamnese (intake). O terapeuta carrega um e personaliza.
// Dados puros (sem I/O) para uso no editor (client) e em telas server.
export type IntakeTemplateQuestion = {
  label: string;
  question_type: IntakeQuestionType;
  is_required: boolean;
};

export type IntakeTemplate = {
  key: string;
  name: string;
  questions: IntakeTemplateQuestion[];
};

const lt = (label: string, is_required = false): IntakeTemplateQuestion => ({ label, question_type: "long_text", is_required });

export const INTAKE_TEMPLATES: IntakeTemplate[] = [
  {
    key: "integrativa",
    name: "Anamnese Integrativa",
    questions: [
      lt("Qual é o seu principal motivo de consulta?", true),
      lt("Quais sintomas ou questões são mais importantes no momento?"),
      lt("Há quanto tempo está experienciando esses sintomas?"),
      lt("Já realizou outros tratamentos ou acompanhamentos? Se sim, quais?"),
      lt("O que você gostaria de melhorar na sua saúde e qualidade de vida?"),
      lt("Como está seu sono, energia e nível de estresse?"),
      lt("Tem feito uso de algum medicamento, fitoterápico ou suplemento?"),
      lt("Alguma informação importante que o terapeuta deve saber antes da sessão?"),
    ],
  },
  {
    key: "nutricao",
    name: "Anamnese Nutricional",
    questions: [
      lt("Qual é o seu principal objetivo com o acompanhamento nutricional?", true),
      lt("Tem alguma restrição alimentar, intolerância ou alergia diagnosticada?"),
      lt("Como você descreveria seus hábitos alimentares atuais?"),
      lt("Quantas refeições faz por dia e em quais horários?"),
      lt("Pratica alguma atividade física? Se sim, qual e com que frequência?"),
      lt("Tem histórico de alguma condição relacionada à alimentação (diabetes, dislipidemia, etc.)?"),
      lt("Faz uso de algum suplemento ou medicamento?"),
      lt("Como está sua digestão, trânsito intestinal e hidratação?"),
    ],
  },
  {
    key: "fisioterapia",
    name: "Anamnese Fisioterapêutica",
    questions: [
      lt("Qual é a sua principal queixa ou motivo da consulta?", true),
      lt("Há quanto tempo sente essa dor ou limitação?"),
      lt("A dor é constante ou aparece em determinados movimentos ou posições?"),
      lt("Já realizou algum tratamento anteriormente? Se sim, qual foi o resultado?"),
      lt("Tem algum exame de imagem recente (raio-x, ressonância, ultrassom)?"),
      lt("Pratica alguma atividade física? Qual e com que frequência?"),
      lt("Tem histórico de cirurgias, fraturas ou lesões relevantes?"),
      lt("Alguma informação importante que o terapeuta deve saber?"),
    ],
  },
  {
    key: "saude_mental",
    name: "Anamnese em Saúde Mental",
    questions: [
      lt("O que te trouxe até aqui hoje?", true),
      lt("Como está se sentindo nas últimas semanas?"),
      lt("Está passando por alguma situação específica de estresse ou dificuldade?"),
      lt("Como está sua qualidade de sono?"),
      lt("Tem sentido impacto nas atividades do dia a dia, trabalho ou relacionamentos?"),
      lt("Já fez acompanhamento psicológico ou psiquiátrico anteriormente?"),
      lt("Faz uso de algum medicamento prescrito por psiquiatra ou clínico?"),
      lt("Há algo que gostaria que eu soubesse antes da nossa conversa?"),
    ],
  },
  {
    key: "wellness",
    name: "Anamnese de Bem-estar",
    questions: [
      lt("O que te motivou a buscar um cuidado de bem-estar agora?", true),
      lt("Como está sua qualidade de sono, energia e disposição no dia a dia?"),
      lt("Qual é o seu nível de estresse atualmente (baixo, moderado, alto)?"),
      lt("Tem algum objetivo específico de saúde ou qualidade de vida?"),
      lt("Pratica alguma atividade física ou prática de movimento?"),
      lt("Como está sua alimentação e hidratação em geral?"),
      lt("Alguma condição de saúde relevante que deva ser considerada?"),
    ],
  },
];
