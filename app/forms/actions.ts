"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentUserProfile } from "@/services/user-service";
import { deleteAssessmentTemplate } from "@/services/assessment-service";

export async function deleteTemplateAction(templateId: string): Promise<void> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");
  await deleteAssessmentTemplate(templateId);
  revalidatePath("/forms");
}

const QSNA_TEMPLATE = {
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

const QRM_TEMPLATE = {
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

export async function importQRMAction() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const supabase = await createSupabaseServerClient();
  const clinicId = profile.clinic_id;

  const { data: template, error: tErr } = await supabase
    .from("assessment_templates")
    .insert({
      clinic_id: clinicId,
      name: QRM_TEMPLATE.name,
      description: QRM_TEMPLATE.description,
      instructions: QRM_TEMPLATE.instructions,
      is_active: true,
    })
    .select("id")
    .single();

  if (tErr) throw tErr;

  for (let si = 0; si < QRM_TEMPLATE.sections.length; si++) {
    const sec = QRM_TEMPLATE.sections[si];

    const { data: section, error: sErr } = await supabase
      .from("assessment_sections")
      .insert({ template_id: template.id, title: sec.title, order_index: si })
      .select("id")
      .single();

    if (sErr) throw sErr;

    const questionRows = sec.questions.map((text, qi) => ({
      template_id: template.id,
      section_id: section.id,
      text,
      question_type: "scale",
      min_score: 0,
      max_score: 4,
      order_index: qi,
      is_required: false,
    }));

    const { error: qErr } = await supabase.from("assessment_questions").insert(questionRows);
    if (qErr) throw qErr;
  }

  revalidatePath("/forms");
}

// ── Generic helper ────────────────────────────────────────────────────────────
async function importTemplate(
  template: {
    name: string;
    description: string;
    instructions: string;
    sections: { title: string; questions: string[]; minScore?: number; maxScore?: number }[];
  },
  clinicId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const { data: tpl, error: tErr } = await supabase
    .from("assessment_templates")
    .insert({ clinic_id: clinicId, name: template.name, description: template.description, instructions: template.instructions, is_active: true })
    .select("id")
    .single();
  if (tErr) throw tErr;

  for (let si = 0; si < template.sections.length; si++) {
    const sec = template.sections[si];
    const { data: section, error: sErr } = await supabase
      .from("assessment_sections")
      .insert({ template_id: tpl.id, title: sec.title, order_index: si })
      .select("id")
      .single();
    if (sErr) throw sErr;

    const questionRows = sec.questions.map((text, qi) => ({
      template_id: tpl.id,
      section_id: section.id,
      text,
      question_type: "scale",
      min_score: sec.minScore ?? 0,
      max_score: sec.maxScore ?? 4,
      order_index: qi,
      is_required: false,
    }));
    const { error: qErr } = await supabase.from("assessment_questions").insert(questionRows);
    if (qErr) throw qErr;
  }
}

// ── PHQ-9 PT-BR ───────────────────────────────────────────────────────────────
const PHQ9_PT_TEMPLATE = {
  name: "PHQ-9 — Questionário sobre a Saúde do Paciente",
  description: "Rastreio de depressão validado com 9 itens. Escala de 0–3 por item.",
  instructions: "Durante as últimas 2 semanas, com que frequência você foi incomodado/a pelos problemas abaixo?\n0 – Nenhuma vez\n1 – Vários dias\n2 – Mais da metade dos dias\n3 – Quase todos os dias\n\nPontuação: 0–4 sem depressão • 5–9 leve • 10–14 moderada • 15–19 moderadamente grave • 20–27 grave",
  sections: [{
    title: "DEPRESSÃO",
    minScore: 0, maxScore: 3,
    questions: [
      "Pouco interesse ou pouco prazer em fazer as coisas",
      "Se sentir \"para baixo\", deprimido/a ou sem perspectiva",
      "Dificuldade para pegar no sono ou permanecer dormindo, ou dormir mais do que de costume",
      "Se sentir cansado/a ou com pouca energia",
      "Falta de apetite ou comendo demais",
      "Se sentir mal consigo mesmo/a — ou achar que você é um fracasso ou que decepcionou sua família ou você mesmo/a",
      "Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão",
      "Lentidão para se movimentar ou falar, a ponto das outras pessoas perceberem? Ou o oposto — estar tão agitado/a ou irrequieto/a que você fica andando de um lado para o outro muito mais do que de costume",
      "Pensar em se ferir de alguma maneira ou que seria melhor estar morto/a",
    ],
  }],
};

// ── PHQ-9 EN ─────────────────────────────────────────────────────────────────
const PHQ9_EN_TEMPLATE = {
  name: "PHQ-9 — Patient Health Questionnaire",
  description: "Validated 9-item depression screening tool. 0–3 scale per item.",
  instructions: "Over the last 2 weeks, how often have you been bothered by the following problems?\n0 – Not at all\n1 – Several days\n2 – More than half the days\n3 – Nearly every day\n\nScoring: 5=mild • 10=moderate • 15=moderately severe • 20=severe depression",
  sections: [{
    title: "DEPRESSION",
    minScore: 0, maxScore: 3,
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed or hopeless",
      "Trouble falling asleep, staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
      "Trouble concentrating on things, such as reading the newspaper or watching television",
      "Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
      "Thoughts that you would be better off dead or of hurting yourself in some way",
    ],
  }],
};

// ── GAD-7 PT-BR ───────────────────────────────────────────────────────────────
const GAD7_PT_TEMPLATE = {
  name: "GAD-7 — Transtorno de Ansiedade Generalizada (TAG)",
  description: "Escala validada de 7 itens para rastreio de ansiedade generalizada.",
  instructions: "Durante as últimas 2 semanas, com que frequência você foi incomodado/a pelos problemas abaixo?\n0 – Nenhuma vez\n1 – Vários dias\n2 – Mais da metade dos dias\n3 – Quase todos os dias\n\nPontuação: 0–4 mínima • 5–9 leve • 10–14 moderada • ≥15 grave",
  sections: [{
    title: "ANSIEDADE",
    minScore: 0, maxScore: 3,
    questions: [
      "Sentir-se nervoso/a, ansioso/a ou muito tenso/a",
      "Não ser capaz de parar ou controlar as preocupações",
      "Preocupar-se muito com diferentes coisas",
      "Dificuldade para relaxar",
      "Ficar tão agitado/a que se torna difícil ficar parado/a",
      "Tornar-se facilmente irritado/a ou aborrecido/a",
      "Sentir medo como se algo terrível pudesse acontecer",
    ],
  }],
};

// ── GAD-7 EN ─────────────────────────────────────────────────────────────────
const GAD7_EN_TEMPLATE = {
  name: "GAD-7 — Generalized Anxiety Disorder",
  description: "Validated 7-item anxiety screening scale.",
  instructions: "Over the last 2 weeks, how often have you been bothered by the following problems?\n0 – Not at all\n1 – Several days\n2 – More than half the days\n3 – Nearly every day\n\nScoring: 0–4 minimal • 5–9 mild • 10–14 moderate • ≥15 severe anxiety",
  sections: [{
    title: "ANXIETY",
    minScore: 0, maxScore: 3,
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless that it is hard to sit still",
      "Becoming easily annoyed or irritable",
      "Feeling afraid, as if something awful might happen",
    ],
  }],
};

// ── HPA Axis PT-BR ────────────────────────────────────────────────────────────
const HPA_PT_TEMPLATE = {
  name: "Eixo HPA — Questionário de Avaliação",
  description: "Avalia disfunções do eixo hipotálamo-hipófise-adrenal em 3 padrões clínicos.",
  instructions: "Avalie cada sintoma APENAS se você o experimenta atualmente.\n0 – Não experimento\n1 – Problema leve\n2 – Problema significativo\n3 – Problema grave\n4 – Problema severo\n\nSomatorias críticas:\n• Seção 1 (Baixo Cortisol): ≥38 significativo, ≥64 crítico\n• Seção 2 (Alto Cortisol): ≥14 significativo, ≥28 crítico\n• Seção 3 (Hiperplasia Adrenal): ≥8 significativo, ≥12 crítico",
  sections: [
    {
      title: "SEÇÃO 1 — ESTADO DE BAIXO CORTISOL",
      minScore: 0, maxScore: 4,
      questions: [
        "Depressão letárgica",
        "Necessidade excessiva de dormir",
        "Síndrome da fadiga crônica",
        "Dor crônica",
        "Fibromialgia (pontos musculoesqueléticos identificados por médico especialista)",
        "Tontura ao levantar ou se inclinar",
        "Baixa pressão sanguínea e/ou diminuição da pressão ao levantar",
        "Desejo de comidas salgadas — salgadinhos, picles etc.",
        "Cicatrização de feridas prejudicada",
        "Hematomas com facilidade",
        "Fadiga",
        "Inabilidade de controlar até pequenos estresses",
        "Hipoglicemia: tontura, irritação, sonolência quando sem se alimentar por 4–5h; sintomas aliviados pela comida",
        "Feridas, cotovelos ou pele perto das unhas invulgarmente escuras",
        "Lenta cicatrização de cortes",
        "Temperaturas corporais instáveis (sensação de muito calor ou frio)",
      ],
    },
    {
      title: "SEÇÃO 2 — ESTADO DE ALTO CORTISOL",
      minScore: 0, maxScore: 4,
      questions: [
        "Depressão agitada",
        "Ganho de peso no abdome, nuca, rosto e bochechas",
        "Estrias que não são de emagrecimento",
        "Início de diabetes ou pré-diabetes",
        "Osteoporose",
        "Desejo de doces",
        "Problemas de quedas ou dormência",
      ],
    },
    {
      title: "SEÇÃO 3 — HIPERPLASIA ADRENAL",
      minScore: 0, maxScore: 4,
      questions: [
        "Crescimento excessivo de pelos escuros (padrão masculino) em mulheres",
        "Períodos menstruais irregulares ou ausentes (não menopausa)",
        "Herança genética de leste europeu",
      ],
    },
  ],
};

// ── HPA Axis EN ───────────────────────────────────────────────────────────────
const HPA_EN_TEMPLATE = {
  name: "HPA Axis — Assessment Questionnaire",
  description: "Assesses hypothalamus-pituitary-adrenal axis dysfunction across 3 clinical patterns.",
  instructions: "Score only items you currently experience.\n0 – Not experiencing\n1 – Mild problem\n2 – Significant problem\n3 – Major problem\n4 – Severe problem\n\nSignificant thresholds:\n• Section 1 (Low Cortisol): ≥38 significant, ≥64 critical\n• Section 2 (High Cortisol): ≥14 significant, ≥28 critical\n• Section 3 (Adrenal Hyperplasia): ≥8 significant, ≥12 critical",
  sections: [
    {
      title: "SECTION 1 — LOW CORTISOL STATE",
      minScore: 0, maxScore: 4,
      questions: [
        "Lethargic depression",
        "Excessive need to sleep",
        "Chronic fatigue syndrome",
        "Chronic pain",
        "Fibromyalgia (musculoskeletal points identified by specialist physician)",
        "Dizziness when standing up or bending over",
        "Low blood pressure and/or dropping blood pressure when standing",
        "Craving for salty foods (chips, pickles, etc.)",
        "Impaired wound healing",
        "Easy bruising",
        "Fatigue",
        "Inability to handle even small stresses",
        "Hypoglycemia: dizziness, irritability, sleepiness when without food for 4–5 hours; symptoms relieved by food",
        "Wounds, elbows, or skin near nails that are unusually dark",
        "Slow healing of cuts",
        "Unstable body temperatures (hot or cold)",
      ],
    },
    {
      title: "SECTION 2 — HIGH CORTISOL STATE",
      minScore: 0, maxScore: 4,
      questions: [
        "Agitated depression",
        "Weight gain in abdomen, back of neck, face, and cheeks",
        "Stretch marks not from weight loss",
        "Onset of diabetes or pre-diabetes",
        "Osteoporosis",
        "Craving for sweets",
        "Problems with falling or numbness",
      ],
    },
    {
      title: "SECTION 3 — ADRENAL HYPERPLASIA",
      minScore: 0, maxScore: 4,
      questions: [
        "Excessive dark hair growth (male pattern) in women",
        "Irregular or absent menstrual periods (not menopause)",
        "Eastern European genetic heritage",
      ],
    },
  ],
};

// ── MSQ EN ────────────────────────────────────────────────────────────────────
const MSQ_EN_TEMPLATE = {
  name: "MSQ — Medical Symptoms Questionnaire",
  description: "Evaluates symptoms across 15 body systems over the past 30 days. 0–4 scale per symptom.",
  instructions: "Based on the past 30 days, rate each symptom:\n0 – Never or almost never\n1 – Occasionally, effect not severe\n2 – Occasionally, effect severe\n3 – Frequently, effect not severe\n4 – Frequently, effect severe\n\nTotal score >50 indicates significant toxicity burden.",
  sections: [
    { title: "HEAD", questions: ["Headaches", "Faintness", "Dizziness", "Insomnia"] },
    { title: "EYES", questions: ["Watery or itchy eyes", "Swollen, reddened, or sticky eyelids", "Bags or dark circles under eyes", "Blurred or tunnel vision (not nearsightedness or farsightedness)"] },
    { title: "EARS", questions: ["Itchy ears", "Earaches, ear infections", "Drainage from ear", "Ringing in ears, hearing loss"] },
    { title: "NOSE", questions: ["Stuffy nose", "Sinus problems", "Runny nose, sneezing, watery eyes and itchy eyes (all together)", "Sneezing attacks", "Excessive mucus formation"] },
    { title: "MOUTH AND THROAT", questions: ["Chronic coughing", "Gagging, frequent need to clear throat", "Sore throat, hoarseness, loss of voice", "Swollen or discolored tongue, gums, lips", "Canker sores"] },
    { title: "SKIN", questions: ["Acne", "Hives, rashes, dry skin", "Hair loss", "Flushing, hot flashes", "Excessive sweating"] },
    { title: "HEART", questions: ["Irregular or skipped heartbeat", "Rapid or pounding heartbeat", "Chest pain"] },
    { title: "LUNGS", questions: ["Chest congestion", "Asthma, bronchitis", "Shortness of breath", "Difficulty breathing"] },
    { title: "DIGESTIVE TRACT", questions: ["Nausea, vomiting", "Diarrhea", "Constipation", "Bloated feeling", "Belching, passing gas", "Heartburn", "Intestinal or stomach pain"] },
    { title: "JOINTS AND MUSCLES", questions: ["Pain or aches in joints", "Arthritis", "Stiffness or limitation of movement", "Pain or aches in muscles", "Feeling of weakness or tiredness"] },
    { title: "ENERGY OR ACTIVITY", questions: ["Fatigue, sluggishness", "Apathy, lethargy", "Hyperactivity", "Restlessness"] },
    { title: "MIND", questions: ["Poor memory", "Confusion, poor comprehension", "Poor concentration", "Poor physical coordination", "Difficulty in making decisions", "Stuttering or stammering", "Slurred speech", "Learning disabilities"] },
    { title: "EMOTIONS", questions: ["Mood swings", "Anxiety, fear, nervousness", "Anger, irritability, aggressiveness", "Depression"] },
    { title: "WEIGHT", questions: ["Binge eating or drinking", "Craving certain foods", "Excessive weight", "Compulsive eating", "Water retention", "Underweight"] },
    { title: "OTHER", questions: ["Frequent illness", "Frequent or urgent urination", "Genital itch or discharge"] },
  ],
};

// ── Export actions for each template ─────────────────────────────────────────
type TemplateInput = { name: string; description: string; instructions: string; sections: { title: string; questions: string[]; minScore?: number; maxScore?: number }[] };
async function runImport(tpl: TemplateInput) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");
  const supabase = await createSupabaseServerClient();
  await importTemplate(tpl, profile.clinic_id, supabase);
  revalidatePath("/forms");
}

export async function importPHQ9PTAction()  { await runImport(PHQ9_PT_TEMPLATE); }
export async function importPHQ9ENAction()  { await runImport(PHQ9_EN_TEMPLATE); }
export async function importGAD7PTAction()  { await runImport(GAD7_PT_TEMPLATE); }
export async function importGAD7ENAction()  { await runImport(GAD7_EN_TEMPLATE); }
export async function importHPAPTAction()   { await runImport(HPA_PT_TEMPLATE); }
export async function importHPAENAction()   { await runImport(HPA_EN_TEMPLATE); }
export async function importMSQENAction()   { await runImport(MSQ_EN_TEMPLATE); }

export async function importQSNAAction() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const supabase = await createSupabaseServerClient();
  const clinicId = profile.clinic_id;

  // Create template
  const { data: template, error: tErr } = await supabase
    .from("assessment_templates")
    .insert({
      clinic_id: clinicId,
      name: QSNA_TEMPLATE.name,
      description: QSNA_TEMPLATE.description,
      instructions: QSNA_TEMPLATE.instructions,
      is_active: true,
    })
    .select("id")
    .single();

  if (tErr) throw tErr;

  // Create sections and questions
  for (let si = 0; si < QSNA_TEMPLATE.sections.length; si++) {
    const sec = QSNA_TEMPLATE.sections[si];

    const { data: section, error: sErr } = await supabase
      .from("assessment_sections")
      .insert({ template_id: template.id, title: sec.title, order_index: si })
      .select("id")
      .single();

    if (sErr) throw sErr;

    const questionRows = sec.questions.map((text, qi) => ({
      template_id: template.id,
      section_id: section.id,
      text,
      question_type: "scale",
      min_score: 0,
      max_score: 4,
      order_index: qi,
      is_required: false,
    }));

    const { error: qErr } = await supabase.from("assessment_questions").insert(questionRows);
    if (qErr) throw qErr;
  }

  revalidatePath("/forms");
}
