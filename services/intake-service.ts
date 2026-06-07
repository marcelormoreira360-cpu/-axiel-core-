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

export async function getIntakeFormWithQuestionsById(formId: string, clinicId?: string): Promise<IntakeFormWithQuestions | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("intake_forms").select("*, intake_questions(*)").eq("id", formId);
  if (clinicId) query = query.eq("clinic_id", clinicId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  const form = data as IntakeFormWithQuestions | null;
  if (!form) return null;
  return {
    ...form,
    intake_questions: [...(form.intake_questions ?? [])].sort((a, b) => a.display_order - b.display_order),
  };
}

// Edita o formulário de intake EM LUGAR (sem criar duplicados):
// atualiza nome/descrição, remove as perguntas deletadas e upserta as demais.
export async function updateIntakeFormWithQuestions(input: {
  form_id: string;
  name: string;
  description?: string | null;
  questions: Array<{ dbId: string | null; label: string; question_type: IntakeQuestionType; is_required: boolean; display_order: number; placeholder?: string | null }>;
  deleted_question_ids: string[];
}): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  // Resolve a clínica do formulário para escopar inserts e o update.
  const { data: form, error: formErr } = await supabase
    .from("intake_forms")
    .select("id, clinic_id")
    .eq("id", input.form_id)
    .maybeSingle();
  if (formErr) throw formErr;
  if (!form) throw new Error("Formulário não encontrado.");

  await supabase
    .from("intake_forms")
    .update({ name: input.name.trim() || "Anamnese", description: input.description ?? null, updated_at: new Date().toISOString() })
    .eq("id", input.form_id);

  if (input.deleted_question_ids.length > 0) {
    await supabase.from("intake_questions").delete().in("id", input.deleted_question_ids);
  }

  for (const q of input.questions) {
    const label = q.label.trim();
    if (!label) continue;
    const placeholder = q.placeholder?.trim() || null;
    if (q.dbId) {
      await supabase
        .from("intake_questions")
        .update({ label, question_type: q.question_type, is_required: q.is_required, display_order: q.display_order, placeholder })
        .eq("id", q.dbId);
    } else {
      await supabase.from("intake_questions").insert({
        clinic_id: form.clinic_id,
        form_id: input.form_id,
        label,
        question_type: q.question_type,
        is_required: q.is_required,
        display_order: q.display_order,
        placeholder,
      });
    }
  }
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
