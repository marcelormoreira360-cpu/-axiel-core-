export type BiomarkerPoint = {
  date: string;       // ISO date string
  value: number;
  ref_min: number | null;
  ref_max: number | null;
  status: string;
  lab_name: string | null;
};

export type BiomarkerSeries = {
  name: string;
  unit: string | null;
  points: BiomarkerPoint[];
};

export type AssessmentPoint = {
  date: string;
  score_percentage: number;
  total_score: number;
  max_possible_score: number;
};

export type AssessmentSeries = {
  template_id: string;
  name: string;
  points: AssessmentPoint[];
};

export type VitalPoint = {
  date: string;  // ISO date string of the session starts_at
  dor: number | null;
  energia: number | null;
  humor: number | null;
  sono: number | null;
};

export type EvolutionData = {
  biomarkers: BiomarkerSeries[];
  assessments: AssessmentSeries[];
  vitals: VitalPoint[];
};

export async function getPatientEvolution(patientId: string): Promise<EvolutionData> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  const [{ data: exams }, { data: assessments }, { data: sessionRecords }] = await Promise.all([
    supabase
      .from("patient_exams")
      .select("exam_date, lab_name, exam_results(biomarker, value, unit, ref_min, ref_max, status)")
      .eq("patient_id", patientId)
      .order("exam_date", { ascending: true }),
    supabase
      .from("assessment_responses")
      .select("filled_at, score_percentage, total_score, max_possible_score, assessment_templates(id, name)")
      .eq("patient_id", patientId)
      .order("filled_at", { ascending: true }),
    supabase
      .from("session_records")
      .select("vitals, appointments(starts_at)")
      .eq("patient_id", patientId)
      .not("vitals", "is", null)
      .order("created_at", { ascending: true }),
  ]);

  // Group exam results by biomarker name
  const biomarkerMap = new Map<string, BiomarkerSeries>();

  for (const exam of exams ?? []) {
    for (const result of (exam.exam_results as any[]) ?? []) {
      const key = result.biomarker.toLowerCase().trim();
      if (!biomarkerMap.has(key)) {
        biomarkerMap.set(key, {
          name: result.biomarker,
          unit: result.unit ?? null,
          points: [],
        });
      }
      biomarkerMap.get(key)!.points.push({
        date: exam.exam_date,
        value: Number(result.value),
        ref_min: result.ref_min != null ? Number(result.ref_min) : null,
        ref_max: result.ref_max != null ? Number(result.ref_max) : null,
        status: result.status,
        lab_name: exam.lab_name ?? null,
      });
    }
  }

  // Only include biomarkers with at least 1 point (show all, even single)
  const biomarkers = Array.from(biomarkerMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Group assessment scores by template
  const assessmentMap = new Map<string, AssessmentSeries>();

  for (const resp of assessments ?? []) {
    const template = (resp as any).assessment_templates;
    if (!template) continue;
    const key = template.id;
    if (!assessmentMap.has(key)) {
      assessmentMap.set(key, {
        template_id: template.id,
        name: template.name,
        points: [],
      });
    }
    assessmentMap.get(key)!.points.push({
      date: resp.filled_at,
      score_percentage: Number(resp.score_percentage ?? 0),
      total_score: Number(resp.total_score ?? 0),
      max_possible_score: Number(resp.max_possible_score ?? 0),
    });
  }

  const assessmentSeries = Array.from(assessmentMap.values()).filter(
    (s) => s.points.length >= 1
  );

  // Build vitals time series from session records
  const vitals: VitalPoint[] = (sessionRecords ?? [])
    .filter((r: any) => r.vitals && r.appointments?.starts_at)
    .map((r: any) => ({
      date:    r.appointments.starts_at,
      dor:     r.vitals?.dor    != null ? Number(r.vitals.dor)    : null,
      energia: r.vitals?.energia != null ? Number(r.vitals.energia) : null,
      humor:   r.vitals?.humor   != null ? Number(r.vitals.humor)  : null,
      sono:    r.vitals?.sono    != null ? Number(r.vitals.sono)   : null,
    }));

  return { biomarkers, assessments: assessmentSeries, vitals };
}
