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
}): Promise<PatientFunctionalExam> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patient_functional_exams")
    .insert({
      clinic_id:   input.clinic_id,
      patient_id:  input.patient_id,
      exam_type:   input.exam_type,
      title:       input.title ?? null,
      summary:     input.summary ?? null,
      findings:    input.findings ?? null,
      exam_date:   input.exam_date,
      file_path:   input.file_path ?? null,
      ai_analysis: input.ai_analysis ?? null,
      created_by:  user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PatientFunctionalExam;
}

export async function deletePatientFunctionalExam(examId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("patient_functional_exams").delete().eq("id", examId);
  if (error) throw error;
}
