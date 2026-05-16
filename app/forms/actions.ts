"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentUserProfile } from "@/services/user-service";

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
