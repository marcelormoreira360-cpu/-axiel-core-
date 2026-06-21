// Motor de progresso: evolução das pontuações de um questionário ao longo do tempo.
// Base para mostrar "sua pontuação variou X% desde o início" na ficha e no portal.
// Inclui o grau de disfunção (Feature 1): faixa do total, faixas por seção e itens sinalizados.

import type { ScoreBand, ScoringConfig } from "@/lib/types";
import { gradeTotal, gradeSection, isItemFlagged, normalizeScoringConfig } from "@/lib/assessment-grading";

export type AssessmentProgressPoint = {
  date: string;
  score_percentage: number;
  total_score: number;
};

export type SectionGrade = {
  title: string;
  score: number;
  max: number;
  band: ScoreBand | null;
};

export type AssessmentProgress = {
  template_id: string;
  template_name: string;
  latest_response_id: string | null;  // última resposta — para abrir o detalhe
  points: AssessmentProgressPoint[]; // ordem cronológica
  baseline: number | null;           // 1ª pontuação (%)
  latest: number | null;             // última pontuação (%)
  deltaPct: number | null;           // latest - baseline (pontos percentuais)
  count: number;
  // Grau de disfunção da última resposta:
  latestTotal: number | null;
  grade: ScoreBand | null;           // faixa do total
  sectionGrades: SectionGrade[];     // faixa por seção (apenas seções pontuadas)
  flaggedCount: number;              // itens na pontuação máxima
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
    .select("id, name, scoring_config")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return null;

  const config: ScoringConfig = normalizeScoringConfig(tpl.scoring_config);

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("id, total_score, score_percentage, section_scores, created_at")
    .eq("patient_id", patientId)
    .eq("template_id", templateId)
    .order("created_at", { ascending: true })
    .limit(50);

  const rows = responses ?? [];
  const points: AssessmentProgressPoint[] = rows.map((r) => ({
    date: r.created_at as string,
    score_percentage: Number(r.score_percentage ?? 0),
    total_score: Number(r.total_score ?? 0),
  }));

  const baseline = points.length ? points[0].score_percentage : null;
  const latest = points.length ? points[points.length - 1].score_percentage : null;
  const deltaPct = baseline != null && latest != null ? Math.round((latest - baseline) * 10) / 10 : null;

  // Grau de disfunção da última resposta
  const last = rows.length ? rows[rows.length - 1] : null;
  const latestTotal = last ? Number(last.total_score ?? 0) : null;
  const grade = latestTotal != null ? gradeTotal(latestTotal, config) : null;

  const sectionScores = (last?.section_scores ?? null) as
    | Record<string, { title: string; score: number; max: number }>
    | null;
  const sectionGrades: SectionGrade[] = sectionScores
    ? Object.values(sectionScores)
        .map((s) => ({
          title: s.title,
          score: Number(s.score ?? 0),
          max: Number(s.max ?? 0),
          band: gradeSection(Number(s.score ?? 0), config),
        }))
        .sort((a, b) => b.score - a.score)
    : [];

  // Itens sinalizados (pontuação máxima) na última resposta
  let flaggedCount = 0;
  if (last && config.flag_item_max) {
    const { data: answers } = await supabase
      .from("assessment_answers")
      .select("value_number, assessment_questions(max_score)")
      .eq("response_id", last.id);
    for (const a of answers ?? []) {
      const q = (a as { assessment_questions?: { max_score?: number } | { max_score?: number }[] }).assessment_questions;
      const maxScore = Array.isArray(q) ? q[0]?.max_score : q?.max_score;
      if (isItemFlagged(Number((a as { value_number?: number }).value_number ?? null), maxScore ?? null, config)) flaggedCount++;
    }
  }

  return {
    template_id: tpl.id as string,
    template_name: tpl.name as string,
    latest_response_id: (last?.id as string) ?? null,
    points,
    baseline,
    latest,
    deltaPct,
    count: points.length,
    latestTotal,
    grade,
    sectionGrades,
    flaggedCount,
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
