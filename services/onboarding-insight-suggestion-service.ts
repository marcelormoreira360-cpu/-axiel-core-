// Detecta pacientes que terminaram os questionários de entrada (templates
// send_on_first_appointment) e ainda NÃO têm um insight de IA — para sugerir ao
// clínico gerar o insight de entrada com 1 clique (governança: rascunho → revisão).
export async function getPatientsNeedingOnboardingInsight(
  clinicId: string,
): Promise<{ patient_id: string; patient_name: string }[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data: tpls } = await supabase
    .from("assessment_templates")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("send_on_first_appointment", true);
  const tplIds = (tpls ?? []).map((t) => t.id as string);
  if (tplIds.length === 0) return [];

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("patient_id, patients(full_name)")
    .eq("clinic_id", clinicId)
    .in("template_id", tplIds);

  const patientMap = new Map<string, string>();
  for (const r of responses ?? []) {
    const p = Array.isArray(r.patients) ? r.patients[0] : r.patients;
    patientMap.set(r.patient_id as string, (p as { full_name?: string } | null)?.full_name ?? "Paciente");
  }
  if (patientMap.size === 0) return [];

  const ids = [...patientMap.keys()];
  const { data: insights } = await supabase
    .from("ai_insights")
    .select("patient_id")
    .eq("clinic_id", clinicId)
    .in("patient_id", ids);
  const haveInsight = new Set((insights ?? []).map((i) => i.patient_id as string));

  return [...patientMap.entries()]
    .filter(([id]) => !haveInsight.has(id))
    .slice(0, 10)
    .map(([patient_id, patient_name]) => ({ patient_id, patient_name }));
}
