export type FunctionalExamType = "neurometria" | "biorressonancia" | "outro";

export type PatientFunctionalExam = {
  id: string;
  clinic_id: string;
  patient_id: string;
  exam_type: FunctionalExamType;
  title: string | null;
  summary: string | null;
  findings: Record<string, unknown> | null;
  exam_date: string;
  file_path: string | null;
  ai_analysis: string | null;
  /** Rascunho da IA { metric_code: valor bruto } extraído do PDF (auditoria; gate humano). */
  metrics_draft: Record<string, number> | null;
  /** Valores revisados/confirmados pelo terapeuta — entram na pirâmide Bio³. */
  metrics_values: Record<string, number> | null;
  /** Carimbo da revisão (gate). Null = pendente. */
  metrics_reviewed_at: string | null;
  metrics_reviewed_by: string | null;
  created_by: string | null;
  created_at: string;
};

export async function getPatientFunctionalExams(patientId: string): Promise<PatientFunctionalExam[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_functional_exams")
    .select("*")
    .eq("patient_id", patientId)
    .order("exam_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PatientFunctionalExam[];
}

/** Sobe o PDF do exame para o bucket patient-docs e devolve o caminho. */
export async function uploadFunctionalExamFile(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  patientId: string,
  clinicId: string,
): Promise<string> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const { randomUUID } = await import("crypto");
  const supabase = createSupabaseAdminClient();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const filePath = `${clinicId}/${patientId}/exams/${randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from("patient-docs")
    .upload(filePath, fileBuffer, { contentType: mimeType, upsert: false });
  if (error) throw error;
  return filePath;
}

export async function createPatientFunctionalExam(input: {
  clinic_id: string;
  patient_id: string;
  exam_type: FunctionalExamType;
  title?: string | null;
  summary?: string | null;
  findings?: Record<string, unknown> | null;
  exam_date: string;
  file_path?: string | null;
  ai_analysis?: string | null;
  /** Rascunho de métricas extraídas pela IA (gate humano: fica pendente até revisão). */
  metrics_draft?: Record<string, number> | null;
}): Promise<PatientFunctionalExam> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const draft = input.metrics_draft && Object.keys(input.metrics_draft).length > 0 ? input.metrics_draft : null;
  const { data, error } = await supabase
    .from("patient_functional_exams")
    .insert({
      clinic_id:     input.clinic_id,
      patient_id:    input.patient_id,
      exam_type:     input.exam_type,
      title:         input.title ?? null,
      summary:       input.summary ?? null,
      findings:      input.findings ?? null,
      exam_date:     input.exam_date,
      file_path:     input.file_path ?? null,
      ai_analysis:   input.ai_analysis ?? null,
      metrics_draft: draft,
      created_by:    user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PatientFunctionalExam;
}

/**
 * Gate humano: grava os valores das métricas revisados/confirmados pelo terapeuta
 * (estes entram na pirâmide Bio³). `values` já vem saneado por code (coerceExamMetricsDraft).
 */
export async function reviewExamMetrics(
  examId: string,
  values: Record<string, number>,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("patient_functional_exams")
    .update({
      metrics_values:      Object.keys(values).length > 0 ? values : null,
      metrics_reviewed_at: new Date().toISOString(),
      metrics_reviewed_by: user?.id ?? null,
    })
    .eq("id", examId);
  if (error) throw error;
}

export async function deletePatientFunctionalExam(examId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("patient_functional_exams").delete().eq("id", examId);
  if (error) throw error;
}
