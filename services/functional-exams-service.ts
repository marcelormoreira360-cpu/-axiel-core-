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

export async function createPatientFunctionalExam(input: {
  clinic_id: string;
  patient_id: string;
  exam_type: FunctionalExamType;
  title?: string | null;
  summary?: string | null;
  findings?: Record<string, unknown> | null;
  exam_date: string;
}): Promise<PatientFunctionalExam> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("patient_functional_exams")
    .insert({
      clinic_id:  input.clinic_id,
      patient_id: input.patient_id,
      exam_type:  input.exam_type,
      title:      input.title ?? null,
      summary:    input.summary ?? null,
      findings:   input.findings ?? null,
      exam_date:  input.exam_date,
      created_by: user?.id ?? null,
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
