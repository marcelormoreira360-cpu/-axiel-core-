"use server";

import { revalidatePath } from "next/cache";
import { QSNA_TEMPLATE, QRM_TEMPLATE } from "@/modules/assessments/canonical-templates";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentUserProfile } from "@/services/user-service";
import { deleteAssessmentTemplate } from "@/services/assessment-service";

export async function deleteTemplateAction(templateId: string): Promise<void> {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");
  await deleteAssessmentTemplate(templateId);
  revalidatePath("/forms");
}



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

// Versão em INGLÊS do Q-SNA (mesma estrutura/escala/faixas do PT). O nome contém
// "Q-SNA", então o motor Bio³ e o "Importar achados" reconhecem por template_match;
// as seções em inglês são mapeadas em question-map.ts (SLEEP/EMOTIONAL/NEUROCOGNITIVE).
const QSNA_EN_TEMPLATE = {
  name: "Q-SNA — Autonomic Nervous System Dysfunction",
  description: "Assesses autonomic nervous system dysfunction across 9 clinical dimensions.",
  instructions:
    "Rate each symptom based on the past 30 days.\n0 – Never or rarely experienced\n1 – Occasionally experienced, mild impact\n2 – Occasionally experienced, severe impact\n3 – Frequently experienced, mild impact\n4 – Frequently experienced, severe impact",
  sections: [
    {
      title: "CARDIOVASCULAR / AUTONOMIC",
      questions: [
        "Palpitations or rapid/irregular heartbeat at rest",
        "Blood pressure instability (at rest or under stress)",
        "Dizziness or lightheadedness when standing up",
        "Intolerance to heat or cold with blood pressure changes",
        "Chest discomfort without structural heart disease diagnosis",
      ],
    },
    {
      title: "RESPIRATORY",
      questions: [
        "Short, irregular, or interrupted breathing under stress",
        "Shortness of breath not proportional to physical effort",
        "Worsening respiratory symptoms during emotional distress",
        "Snoring, sleep apnea, or non-restorative sleep related to breathing",
        "Difficulty coordinating breathing with relaxation",
      ],
    },
    {
      title: "GASTROINTESTINAL / VISCERAL",
      questions: [
        "Frequent reflux, nausea, or heartburn",
        "Recurrent constipation or diarrhea without clear cause",
        "Abdominal pain associated with stress",
        "\"Knot in the stomach\" sensation during anxiety",
        "Appetite changes not explained by diet",
      ],
    },
    {
      title: "INFLAMMATORY / IMMUNOLOGICAL",
      questions: [
        "Frequent or prolonged infections",
        "Diagnosis of autoimmune diseases",
        "Chronic inflammatory symptoms (arthritis, gastritis, dermatitis)",
        "Fatigue after long-lasting infectious processes",
        "Prior lab tests with elevated CRP/IL-6/TNF-α",
      ],
    },
    {
      title: "ENDOCRINE / METABOLIC",
      questions: [
        "Unexplained weight changes (not related to diet or activity)",
        "Persistent fatigue despite adequate sleep",
        "Hair loss, skin changes, or brittle nails",
        "Menstrual irregularities / early menopause / andropause",
        "Prior lab abnormalities (cortisol, insulin, TSH, T4, testosterone, estrogen)",
      ],
    },
    {
      title: "SLEEP / BIOLOGICAL RHYTHMS",
      questions: [
        "Difficulty falling asleep",
        "Waking up multiple times during the night",
        "Non-restorative sleep despite sufficient hours",
        "Excessive daytime sleepiness",
        "Circadian rhythm disruptions (e.g., jet lag, shift work)",
      ],
    },
    {
      title: "NEUROCOGNITIVE / EXECUTIVE FUNCTION",
      questions: [
        "Difficulty concentrating on simple tasks",
        "Frequent forgetfulness under pressure",
        "Repetitive thoughts or excessive worry",
        "Feeling mentally \"stuck\" when making decisions",
        "Reduced creativity or cognitive flexibility",
      ],
    },
    {
      title: "EMOTIONAL / PSYCHOSOCIAL",
      questions: [
        "Persistent anxiety or daily worry",
        "Depressed mood or loss of interest",
        "Frequent irritability or exaggerated emotional reactions",
        "Difficulty recovering after stressful events",
        "Hypervigilance or difficulty relaxing",
      ],
    },
    {
      title: "AGING / VITALITY",
      questions: [
        "Chronic fatigue disproportionate to effort",
        "Slow recovery after physical activity or stress",
        "Progressive loss of strength or vitality",
        "Reduced motivation for enjoyable activities",
        "Frequent diffuse pain without clear diagnosis",
      ],
    },
  ],
};

async function importTemplateFromDef(
  def: { name: string; description: string; instructions: string; sections: { title: string; questions: string[] }[] },
) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) throw new Error("Clínica obrigatória");

  const supabase = await createSupabaseServerClient();
  const clinicId = profile.clinic_id;

  const { data: template, error: tErr } = await supabase
    .from("assessment_templates")
    .insert({
      clinic_id: clinicId,
      name: def.name,
      description: def.description,
      instructions: def.instructions,
      is_active: true,
    })
    .select("id")
    .single();
  if (tErr) throw tErr;

  for (let si = 0; si < def.sections.length; si++) {
    const sec = def.sections[si];
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

export async function importQSNAENAction() {
  await importTemplateFromDef(QSNA_EN_TEMPLATE);
}

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
