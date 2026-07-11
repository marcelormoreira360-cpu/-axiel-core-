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
  // Valores por chave de vital (dinâmicos, config por clínica): dor/energia/humor/
  // sono ou customizados.
  values: Record<string, number | null>;
};

// Definição de um vital para o gráfico (chave, rótulo custom, cor). O rótulo dos
// vitais PADRÃO vem vazio e é resolvido por i18n no componente.
export type VitalDef = {
  key: string;
  label: string;
  color: string;
};

export type EvolutionData = {
  biomarkers: BiomarkerSeries[];
  assessments: AssessmentSeries[];
  vitals: VitalPoint[];
  vitalDefs: VitalDef[];
  vitalsScaleMax: number;
};

export async function getPatientEvolution(patientId: string): Promise<EvolutionData> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const { getCurrentClinic, getClinicSessionConfig } = await import("@/services/clinic-service");
  const { defaultSessionConfig } = await import("@/modules/session/session-config");

  const supabase = await createSupabaseServerClient();

  // Config de vitais/escala da clínica: o gráfico mostra os vitais configurados
  // (inclusive customizados) na escala certa, em vez dos 4 fixos + escala 1–5.
  const clinic = await getCurrentClinic();
  const sessionConfig = clinic ? await getClinicSessionConfig(clinic.id) : defaultSessionConfig();

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

  type ExamResult = { biomarker: string; value: string | number; unit: string | null; ref_min: string | number | null; ref_max: string | number | null; status: string };

  for (const exam of exams ?? []) {
    for (const result of (exam.exam_results as ExamResult[]) ?? []) {
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
    const raw = resp as unknown as { assessment_templates?: { id: string; name: string } | { id: string; name: string }[] | null };
    const tmpl = raw.assessment_templates;
    const template = Array.isArray(tmpl) ? tmpl[0] ?? null : (tmpl ?? null);
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
  type SessionVitalsRow = {
    vitals: Record<string, number | null> | null;
    appointments: { starts_at: string } | { starts_at: string }[] | null;
  };

  const vitals: VitalPoint[] = (sessionRecords ?? [])
    .map((r) => {
      const row = r as unknown as SessionVitalsRow;
      const appt = Array.isArray(row.appointments) ? row.appointments[0] ?? null : row.appointments;
      return { vitals: row.vitals, starts_at: appt?.starts_at ?? null };
    })
    .filter((r): r is { vitals: Record<string, number | null>; starts_at: string } =>
      Boolean(r.vitals && r.starts_at)
    )
    .map((r) => ({
      date: r.starts_at,
      // Um valor por vital configurado (chaves reais dos dados).
      values: Object.fromEntries(
        sessionConfig.vitals.map((cv) => [
          cv.key,
          r.vitals?.[cv.key] != null ? Number(r.vitals[cv.key]) : null,
        ]),
      ) as Record<string, number | null>,
    }));

  const vitalDefs: VitalDef[] = sessionConfig.vitals.map((cv) => ({
    key: cv.key,
    label: cv.label,
    color: cv.color,
  }));

  return {
    biomarkers,
    assessments: assessmentSeries,
    vitals,
    vitalDefs,
    vitalsScaleMax: sessionConfig.scaleMax,
  };
}
