export type ExamResult = {
  id: string;
  exam_id: string;
  biomarker: string;
  value: number;
  unit: string | null;
  ref_min: number | null;
  ref_max: number | null;
  status: "low" | "normal" | "high" | "unknown";
};

export type PatientExam = {
  id: string;
  patient_id: string;
  clinic_id: string;
  exam_date: string;
  lab_name: string | null;
  notes: string | null;
  created_at: string;
  exam_results: ExamResult[];
};

export type Prescription = {
  id: string;
  patient_id: string;
  clinic_id: string;
  type: "medication" | "supplement";
  name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export async function getPatientExams(patientId: string): Promise<PatientExam[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("patient_exams")
    .select("*, exam_results(*)")
    .eq("patient_id", patientId)
    .order("exam_date", { ascending: false });
  return (data ?? []) as PatientExam[];
}

export async function createPatientExam(input: {
  patient_id: string;
  clinic_id: string;
  exam_date: string;
  lab_name?: string | null;
  notes?: string | null;
  results: { biomarker: string; value: number; unit?: string; ref_min?: number | null; ref_max?: number | null }[];
}): Promise<PatientExam> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  const { data: exam, error: eErr } = await supabase
    .from("patient_exams")
    .insert({
      patient_id: input.patient_id,
      clinic_id: input.clinic_id,
      exam_date: input.exam_date,
      lab_name: input.lab_name ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (eErr) throw eErr;

  if (input.results.length > 0) {
    const { error: rErr } = await supabase.from("exam_results").insert(
      input.results.map((r) => ({
        exam_id: exam.id,
        biomarker: r.biomarker,
        value: r.value,
        unit: r.unit ?? null,
        ref_min: r.ref_min ?? null,
        ref_max: r.ref_max ?? null,
      }))
    );
    if (rErr) throw rErr;
  }

  return { ...exam, exam_results: [] } as PatientExam;
}

export async function deletePatientExam(examId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  await supabase.from("patient_exams").delete().eq("id", examId);
}

export async function getPatientPrescriptions(patientId: string): Promise<Prescription[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("patient_prescriptions")
    .select("*")
    .eq("patient_id", patientId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as Prescription[];
}

export async function createPrescription(input: {
  patient_id: string;
  clinic_id: string;
  type: "medication" | "supplement";
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  start_date?: string | null;
  notes?: string | null;
}): Promise<Prescription> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_prescriptions")
    .insert({ ...input, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data as Prescription;
}

export async function deactivatePrescription(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("patient_prescriptions")
    .update({ is_active: false, end_date: new Date().toISOString().split("T")[0] })
    .eq("id", id);
}

export async function deletePrescription(id: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  await supabase.from("patient_prescriptions").delete().eq("id", id);
}
