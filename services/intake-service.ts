import type { IntakeForm, IntakeFormWithQuestions, IntakeQuestion, IntakeQuestionType, IntakeResponse } from "@/lib/types";

export async function getIntakeForms(clinicId?: string): Promise<IntakeForm[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("intake_forms").select("*").order("created_at", { ascending: false });
  if (clinicId) query = query.eq("clinic_id", clinicId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getActiveIntakeForm(clinicId?: string): Promise<IntakeFormWithQuestions | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("intake_forms")
    .select("*, intake_questions(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;
  const form = data?.[0] as IntakeFormWithQuestions | undefined;
  if (!form) return null;

  return {
    ...form,
    intake_questions: [...(form.intake_questions ?? [])].sort((a, b) => a.display_order - b.display_order),
  };
}

export async function createIntakeFormWithQuestions(input: {
  clinic_id: string;
  name: string;
  description?: string | null;
  questions: Array<{ label: string; question_type: IntakeQuestionType; is_required: boolean; placeholder?: string | null }>;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: form, error: formError } = await supabase
    .from("intake_forms")
    .insert({
      clinic_id: input.clinic_id,
      created_by: user?.id ?? null,
      name: input.name,
      description: input.description ?? null,
      is_active: true,
    })
    .select("*")
    .single();

  if (formError) throw formError;

  const rows = input.questions
    .filter((question) => question.label.trim().length > 0)
    .map((question, index) => ({
      clinic_id: input.clinic_id,
      form_id: form.id,
      label: question.label.trim(),
      question_type: question.question_type,
      is_required: question.is_required,
      placeholder: question.placeholder ?? null,
      display_order: index,
    }));

  if (rows.length > 0) {
    const { error: questionsError } = await supabase.from("intake_questions").insert(rows);
    if (questionsError) throw questionsError;
  }

  return form as IntakeForm;
}

export async function savePatientIntakeResponses(input: {
  clinic_id: string;
  patient_id: string;
  form_id: string;
  responses: Array<{ question_id: string; answer: string | null }>;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = input.responses.map((response) => ({
    clinic_id: input.clinic_id,
    patient_id: input.patient_id,
    form_id: input.form_id,
    question_id: response.question_id,
    answer: response.answer,
    created_by: user?.id ?? null,
  }));

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("intake_responses")
    .upsert(rows, { onConflict: "patient_id,question_id" })
    .select("*");

  if (error) throw error;
  return data as IntakeResponse[];
}

export async function getPatientIntakeResponses(patientId: string): Promise<IntakeResponse[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("intake_responses")
    .select("*, intake_questions(id, label, question_type, display_order)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as IntakeResponse[];
}
