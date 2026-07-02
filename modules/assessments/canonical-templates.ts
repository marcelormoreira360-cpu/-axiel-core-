// Templates CANÔNICOS do método Neuro ID (Q-SNA e QRM, pt-BR).
// Extraídos de app/forms/actions.ts para poderem ser semeados também no
// onboarding de clínica nova (services/assessment-seed-service.ts) — um
// arquivo "use server" não pode exportar constantes.
// O motor Bio³ reconhece os questionários pelo NOME (template_match), então
// os nomes "Q-SNA" e "Q.R.M." não devem mudar.

export type CanonicalTemplate = {
  name: string;
  description: string;
  instructions: string;
  sections: { title: string; questions: string[] }[];
};

export const QSNA_TEMPLATE: CanonicalTemplate = {
  name: "Q-SNA — Sistema Nervoso Autônomo",
  description: "Avalia disfunções do sistema nervoso autônomo em 9 dimensões clínicas.",
  instructions:
    "Avalie cada sintoma com base nos últimos 30 dias.\n0 – Nunca ou quase nunca\n1 – Ocasionalmente, efeito não severo\n2 – Ocasionalmente, efeito severo\n3 – Frequentemente, efeito não severo\n4 – Frequentemente, efeito severo",
  sections: [
    {
      title: "CARDIOVASCULAR / AUTONÔMICA",
      questions: [
        "Palpitações ou batimentos acelerados/irregulares em repouso",
        "Pressão arterial instável diante de estresse ou em repouso",
        "Tontura ou pré-síncope ao levantar-se",
        "Intolerância ao calor ou frio com alterações de pressão",
        "Desconforto torácico sem diagnóstico cardíaco estrutural",
      ],
    },
    {
      title: "RESPIRATÓRIA",
      questions: [
        "Respiração curta, irregular ou suspensa sob estresse",
        "Falta de ar sem esforço físico proporcional",
        "Piora de sintomas respiratórios durante crises emocionais",
        "Roncos, apneias ou sono não reparador relacionado à respiração",
        "Dificuldade em coordenar respiração com relaxamento",
      ],
    },
    {
      title: "GASTROINTESTINAL / VISCERAL",
      questions: [
        "Refluxo, náusea ou azia frequente",
        "Constipação ou diarreia recorrente sem causa definida",
        "Dor abdominal associada ao estresse",
        "Sensação de 'nó no estômago' em momentos de ansiedade",
        "Alterações de apetite não explicadas por dieta",
      ],
    },
    {
      title: "INFLAMATÓRIA / IMUNOLÓGICA",
      questions: [
        "Infecções frequentes ou prolongadas",
        "Diagnóstico de doenças autoimunes",
        "Sintomas inflamatórios crônicos (artrite, gastrite, dermatite)",
        "Cansaço após processos infecciosos de longa duração",
        "Exames laboratoriais prévios com PCR/IL-6/TNF-α elevados",
      ],
    },
    {
      title: "ENDÓCRINO / METABÓLICA",
      questions: [
        "Alterações de peso não explicadas por dieta ou atividade física",
        "Excesso de cansaço, mesmo com sono adequado",
        "Queda de cabelo, alterações de pele ou unhas frágeis",
        "Alterações menstruais / menopausa precoce / andropausa",
        "Exames prévios com alterações hormonais (cortisol, insulina, TSH, T4, testosterona, estrogênio)",
      ],
    },
    {
      title: "SONO / RITMOS BIOLÓGICOS",
      questions: [
        "Dificuldade para iniciar o sono",
        "Acorda várias vezes durante a noite",
        "Sono não reparador mesmo dormindo horas suficientes",
        "Sonolência excessiva durante o dia",
        "Alterações de ritmo biológico (jet lag, turnos noturnos)",
      ],
    },
    {
      title: "NEUROCOGNITIVA / EXECUTIVA",
      questions: [
        "Dificuldade de concentração em tarefas simples",
        "Esquecimento frequente sob pressão",
        "Pensamentos repetitivos ou preocupação excessiva",
        "Sensação de 'mente travada' em decisões cotidianas",
        "Redução da criatividade ou flexibilidade cognitiva",
      ],
    },
    {
      title: "EMOCIONAL / PSICOSSOCIAL",
      questions: [
        "Ansiedade persistente ou preocupação diária",
        "Humor deprimido ou perda de interesse",
        "Irritabilidade frequente ou reatividade exagerada",
        "Dificuldade em recuperar-se após eventos estressantes",
        "Hipervigilância ou dificuldade em relaxar",
      ],
    },
    {
      title: "ENVELHECIMENTO / VITALIDADE",
      questions: [
        "Fadiga crônica desproporcional ao esforço",
        "Recuperação lenta após atividade física ou estresse",
        "Perda progressiva de força ou energia vital",
        "Redução de motivação para atividades prazerosas",
        "Queixas frequentes de dor difusa sem diagnóstico claro",
      ],
    },
  ],
};

export const QRM_TEMPLATE: CanonicalTemplate = {
  name: "Q.R.M. — Questionário de Rastreamento Metabólico",
  description: "Avalia sintomas metabólicos em 14 sistemas corporais com escala de 0 a 4.",
  instructions:
    "Avalie cada sintoma com base nos últimos 30 dias.\n0 – Nunca ou quase nunca\n1 – Ocasionalmente, efeito não severo\n2 – Ocasionalmente, efeito severo\n3 – Frequentemente, efeito não severo\n4 – Frequentemente, efeito severo",
  sections: [
    {
      title: "CABEÇA",
      questions: [
        "Dor de cabeça",
        "Sensação de desmaio",
        "Tontura",
        "Insônia",
      ],
    },
    {
      title: "OLHOS",
      questions: [
        "Lacrimejamento ou coçando",
        "Inchados, vermelhos ou cílios colando",
        "Bolsas ou olheiras",
        "Visão borrada ou em túnel",
      ],
    },
    {
      title: "OUVIDOS",
      questions: [
        "Coceira nos ouvidos",
        "Dores ou infecções nos ouvidos",
        "Retirada de ruído purulento",
        "Zunido ou perda de audição",
      ],
    },
    {
      title: "NARIZ",
      questions: [
        "Nariz entupido",
        "Sinusite",
        "Corrimento, espirros ou lacrimejamento nasal",
        "Ataques de espirros",
        "Excesso de muco",
      ],
    },
    {
      title: "BOCA / GARGANTA",
      questions: [
        "Tosse crônica",
        "Necessidade frequente de limpar a garganta",
        "Dor ou rouquidão na garganta",
        "Língua, gengivas ou lábios inchados",
        "Aftas",
      ],
    },
    {
      title: "PELE",
      questions: [
        "Acne",
        "Feridas, erupções ou pele seca",
        "Perda de cabelo",
        "Vermelhidão ou calorões",
        "Suor excessivo",
      ],
    },
    {
      title: "CORAÇÃO",
      questions: [
        "Batidas irregulares",
        "Batidas rápidas",
        "Dor no peito",
      ],
    },
    {
      title: "PULMÃO",
      questions: [
        "Congestão pulmonar",
        "Asma ou bronquite",
        "Pouco fôlego",
        "Dificuldade de respirar",
      ],
    },
    {
      title: "TRATO DIGESTIVO",
      questions: [
        "Náuseas ou vômitos",
        "Diarreia",
        "Constipação",
        "Inchaço abdominal",
        "Arrotos ou gases",
        "Azia",
        "Dor estomacal",
      ],
    },
    {
      title: "ARTICULAÇÕES / MÚSCULOS",
      questions: [
        "Dores articulares",
        "Artrite ou artrose",
        "Rigidez ou limitação de movimentos",
        "Dores musculares",
        "Fraqueza ou cansaço muscular",
      ],
    },
    {
      title: "ENERGIA / ATIVIDADE",
      questions: [
        "Fadiga ou moleza",
        "Apatia ou letargia",
        "Hiperatividade",
        "Dificuldade de relaxar",
        "Fraqueza ou cansaço geral",
      ],
    },
    {
      title: "MENTE",
      questions: [
        "Memória ruim",
        "Confusão mental",
        "Concentração ruim",
        "Fraca coordenação",
        "Dificuldade de tomar decisões",
        "Fala repetitiva ou com pausas",
        "Pronúncia indistinta",
        "Problemas de aprendizagem",
      ],
    },
    {
      title: "EMOÇÕES",
      questions: [
        "Mudança de humor",
        "Ansiedade, medo ou nervosismo",
        "Raiva ou irritabilidade",
        "Depressão",
      ],
    },
    {
      title: "OUTROS",
      questions: [
        "Fica frequentemente doente",
        "Necessidade urgente de urinar",
        "Coceira genital ou corrimento",
        "Edema ou inchaço",
      ],
    },
  ],
};
