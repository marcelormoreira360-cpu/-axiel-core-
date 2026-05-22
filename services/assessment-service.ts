import type {
  AssessmentTemplate,
  AssessmentSection,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentAnswer,
  TemplateWithStructure,
} from "@/lib/types";

export async function getAssessmentTemplates(clinicId?: string): Promise<AssessmentTemplate[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("assessment_templates")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (clinicId) q = q.eq("clinic_id", clinicId);
  const { data } = await q;
  return (data ?? []) as AssessmentTemplate[];
}

export async function getTemplateWithStructure(
  templateId: string
): Promise<TemplateWithStructure | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assessment_templates")
    .select(`*, assessment_sections(*, assessment_questions(*))`)
    .eq("id", templateId)
    .maybeSingle();
  if (!data) return null;
  const template = data as TemplateWithStructure;
  template.assessment_sections.sort((a, b) => a.order_index - b.order_index);
  template.assessment_sections.forEach((s) =>
    s.assessment_questions.sort((a, b) => a.order_index - b.order_index)
  );
  return template;
}

export async function getPatientAssessmentResponses(
  patientId: string
): Promise<AssessmentResponse[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assessment_responses")
    .select("*, assessment_templates(name)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return (data ?? []) as AssessmentResponse[];
}

export async function getAssessmentResponse(
  responseId: string
): Promise<AssessmentResponse | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assessment_responses")
    .select("*, assessment_templates(name)")
    .eq("id", responseId)
    .maybeSingle();
  return (data ?? null) as AssessmentResponse | null;
}

export async function getAssessmentAnswers(responseId: string): Promise<AssessmentAnswer[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assessment_answers")
    .select("*")
    .eq("response_id", responseId);
  return (data ?? []) as AssessmentAnswer[];
}

export async function createAssessmentTemplate(input: {
  clinic_id: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  scale_labels?: string[] | null;
}): Promise<AssessmentTemplate> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assessment_templates")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as AssessmentTemplate;
}

export async function createAssessmentSection(input: {
  template_id: string;
  title: string;
  order_index: number;
}): Promise<AssessmentSection> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assessment_sections")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as AssessmentSection;
}

export async function createAssessmentQuestion(input: {
  template_id: string;
  section_id?: string | null;
  text: string;
  question_type: string;
  min_score?: number;
  max_score?: number;
  options?: { label: string; value: number }[] | null;
  order_index: number;
}): Promise<AssessmentQuestion> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assessment_questions")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as AssessmentQuestion;
}

export async function submitAssessmentResponse(input: {
  template_id: string;
  patient_id: string;
  clinic_id: string;
  answers: {
    question_id: string;
    section_id: string | null;
    value_number?: number | null;
    value_text?: string | null;
  }[];
  section_scores: Record<string, { title: string; score: number; max: number }>;
  total_score: number;
  max_possible_score: number;
  notes?: string | null;
}): Promise<AssessmentResponse> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const score_percentage =
    input.max_possible_score > 0
      ? Math.round((input.total_score / input.max_possible_score) * 10000) / 100
      : 0;

  const { data: response, error: rErr } = await supabase
    .from("assessment_responses")
    .insert({
      template_id: input.template_id,
      patient_id: input.patient_id,
      clinic_id: input.clinic_id,
      total_score: input.total_score,
      max_possible_score: input.max_possible_score,
      score_percentage,
      section_scores: input.section_scores,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (rErr) throw rErr;

  const answersToInsert = input.answers.map((a) => ({
    response_id: response.id,
    question_id: a.question_id,
    score: a.value_number ?? null,
    text_answer: a.value_text ?? null,
  }));
  const { error: aErr } = await supabase
    .from("assessment_answers")
    .insert(answersToInsert);
  if (aErr) throw aErr;

  return response as AssessmentResponse;
}

export async function deleteAssessmentTemplate(templateId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("assessment_templates")
    .update({ is_active: false })
    .eq("id", templateId);
}
