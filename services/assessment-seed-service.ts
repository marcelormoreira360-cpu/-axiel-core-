import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { QSNA_TEMPLATE, QRM_TEMPLATE, type CanonicalTemplate } from "@/modules/assessments/canonical-templates";
import { createLogger } from "@/lib/logger";

const log = createLogger("assessment-seed");

type SeedQuestion = { text: string; question_type: "scale" | "text"; min: number; max: number };
type SeedTemplate = {
  name: string;
  description: string;
  instructions: string | null;
  sections: { title: string; questions: SeedQuestion[] }[];
};

function fromCanonical(tpl: CanonicalTemplate): SeedTemplate {
  return {
    name: tpl.name,
    description: tpl.description,
    instructions: tpl.instructions,
    sections: tpl.sections.map((sec) => ({
      title: sec.title,
      questions: sec.questions.map((text) => ({ text, question_type: "scale" as const, min: 0, max: 4 })),
    })),
  };
}

async function seedOneTemplate(clinicId: string, tpl: SeedTemplate): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  // Idempotente: se a clínica já tem um template com esse nome, não duplica
  const { data: existing } = await supabase
    .from("assessment_templates")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("name", tpl.name)
    .limit(1)
    .maybeSingle();
  if (existing) return false;

  const { data: template, error: tErr } = await supabase
    .from("assessment_templates")
    .insert({
      clinic_id: clinicId,
      name: tpl.name,
      description: tpl.description,
      instructions: tpl.instructions,
      is_active: true,
      // Entra no slot de intake: enviado automaticamente no 1º agendamento
      placement: ["intake"],
      send_on_first_appointment: true,
    })
    .select("id")
    .single();
  if (tErr) throw tErr;

  for (let si = 0; si < tpl.sections.length; si++) {
    const sec = tpl.sections[si];
    const { data: section, error: sErr } = await supabase
      .from("assessment_sections")
      .insert({ template_id: template.id, title: sec.title, order_index: si })
      .select("id")
      .single();
    if (sErr) throw sErr;

    const rows = sec.questions.map((q, qi) => ({
      template_id: template.id,
      section_id: section.id,
      text: q.text,
      question_type: q.question_type,
      min_score: q.min,
      max_score: q.max,
      order_index: qi,
      is_required: false,
    }));
    const { error: qErr } = await supabase.from("assessment_questions").insert(rows);
    if (qErr) throw qErr;
  }
  return true;
}

/**
 * Semeia o MÉTODO na clínica nova: Q-SNA + QRM (motor do Mapa Bio³) e a
 * Anamnese do perfil escolhido no onboarding. Sem isso a clínica nascia com
 * /forms vazio e a pirâmide Bio³ nunca enchia (o diferencial vendável chegava
 * desligado). Idempotente por nome; falha de um template não bloqueia os outros.
 */
export async function seedMethodTemplatesForClinic(
  clinicId: string,
  opts?: { anamnese?: { name: string; questions: string[] } },
): Promise<{ created: string[] }> {
  const created: string[] = [];

  const templates: SeedTemplate[] = [fromCanonical(QSNA_TEMPLATE), fromCanonical(QRM_TEMPLATE)];
  if (opts?.anamnese && opts.anamnese.questions.length > 0) {
    templates.push({
      name: opts.anamnese.name,
      description: "Anamnese criada automaticamente no onboarding.",
      instructions: null,
      sections: [
        {
          title: "Anamnese",
          questions: opts.anamnese.questions.map((text) => ({
            text,
            question_type: "text" as const,
            min: 0,
            max: 0,
          })),
        },
      ],
    });
  }

  for (const tpl of templates) {
    try {
      if (await seedOneTemplate(clinicId, tpl)) created.push(tpl.name);
    } catch (e) {
      log.error("seed de template falhou", e instanceof Error ? e : new Error(String(e)), {
        clinic_id: clinicId,
        template: tpl.name,
      });
    }
  }
  return { created };
}
