import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildUnifiedSeed, buildQuestionRows } from "@/modules/neuro-id/unified-form-seed";
import { createLogger } from "@/lib/logger";

const log = createLogger("unified-form-seed");

/**
 * Semeia o FORMULÁRIO UNIFICADO Neuro ID numa clínica (template + seções +
 * perguntas com `code` e `options`). Requer a coluna `code` (migration 148).
 *
 * USO INTERNO / TESTE: por padrão entra INATIVO e com placement VAZIO — NÃO é
 * enviado automaticamente a paciente. Só o profissional o acessa para testar.
 * Ativar/enviar a paciente real depende das travas de compliance (Bloco F).
 * Idempotente por nome. NÃO altera o onboarding (seedMethodTemplatesForClinic).
 */
export async function seedUnifiedFormForClinic(
  clinicId: string,
  opts?: { activate?: boolean },
): Promise<{ created: boolean; templateId?: string }> {
  const supabase = createSupabaseAdminClient();
  const seed = buildUnifiedSeed();

  const { data: existing } = await supabase
    .from("assessment_templates")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("name", seed.name)
    .limit(1)
    .maybeSingle();
  if (existing) return { created: false, templateId: existing.id };

  const { data: template, error: tErr } = await supabase
    .from("assessment_templates")
    .insert({
      clinic_id: clinicId,
      name: seed.name,
      description: seed.description,
      instructions: seed.instructions,
      is_active: !!opts?.activate,
      placement: [], // vazio: fora do envio automático (uso interno/teste)
      send_on_first_appointment: false,
    })
    .select("id")
    .single();
  if (tErr) throw tErr;

  for (let si = 0; si < seed.sections.length; si++) {
    const sec = seed.sections[si];
    const { data: section, error: sErr } = await supabase
      .from("assessment_sections")
      .insert({ template_id: template.id, title: sec.title, order_index: si })
      .select("id")
      .single();
    if (sErr) throw sErr;

    const rows = buildQuestionRows(template.id, section.id, sec.questions);
    const { error: qErr } = await supabase.from("assessment_questions").insert(rows);
    if (qErr) throw qErr;
  }

  log.info("formulário unificado Neuro ID semeado", { clinic_id: clinicId, template_id: template.id });
  return { created: true, templateId: template.id };
}
