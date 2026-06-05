// Motor de progresso: evolução das pontuações de um questionário ao longo do tempo.
// Base para mostrar "sua pontuação variou X% desde o início" na ficha e no portal.

export type AssessmentProgressPoint = {
  date: string;
  score_percentage: number;
  total_score: number;
};

export type AssessmentProgress = {
  template_id: string;
  template_name: string;
  points: AssessmentProgressPoint[]; // ordem cronológica
  baseline: number | null;           // 1ª pontuação (%)
  latest: number | null;             // última pontuação (%)
  deltaPct: number | null;           // latest - baseline (pontos percentuais)
  count: number;
};

// Progresso de UM template para um paciente.
export async function getAssessmentProgress(
  patientId: string,
  templateId: string,
): Promise<AssessmentProgress | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data: tpl } = await supabase
    .from("assessment_templates")
    .select("id, name")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return null;

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("total_score, score_percentage, created_at")
    .eq("patient_id", patientId)
    .eq("template_id", templateId)
    .order("created_at", { ascending: true })
    .limit(50);

  const points: AssessmentProgressPoint[] = (responses ?? []).map((r) => ({
    date: r.created_at as string,
    score_percentage: Number(r.score_percentage ?? 0),
    total_score: Number(r.total_score ?? 0),
  }));

  const baseline = points.length ? points[0].score_percentage : null;
  const latest = points.length ? points[points.length - 1].score_percentage : null;
  const deltaPct = baseline != null && latest != null ? Math.round((latest - baseline) * 10) / 10 : null;

  return {
    template_id: tpl.id as string,
    template_name: tpl.name as string,
    points,
    baseline,
    latest,
    deltaPct,
    count: points.length,
  };
}

// Progresso de TODOS os templates que o paciente já respondeu (para uma visão geral).
export async function getPatientAssessmentProgress(patientId: string): Promise<AssessmentProgress[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("template_id")
    .eq("patient_id", patientId);

  const templateIds = [...new Set((responses ?? []).map((r) => r.template_id as string).filter(Boolean))];
  const results: AssessmentProgress[] = [];
  for (const id of templateIds) {
    const p = await getAssessmentProgress(patientId, id);
    if (p) results.push(p);
  }
  return results;
}
