import { FORM_TEMPLATES } from "@/modules/forms/form-templates";
import type { AxielForm, FormQuestion, FormSubmissionSummary } from "@/modules/forms/question-types";

const demoForms: AxielForm[] = [
  {
    id: "initial-intake",
    name: "Initial Patient Intake",
    description: "A calm starter form for new patients.",
    category: "Initial Assessment",
    status: "Active",
    question_count: 5,
    updated_at: new Date().toISOString(),
  },
  {
    id: "pain-body-map",
    name: "Pain & Body Map Assessment",
    description: "Areas of attention, intensity, and short notes.",
    category: "Initial Assessment",
    status: "Draft",
    question_count: 4,
    updated_at: new Date().toISOString(),
  },
  {
    id: "stress-sleep",
    name: "Stress and Sleep Check-in",
    description: "A quick follow-up for sleep, stress, and rhythm.",
    category: "Follow-up Form",
    status: "Active",
    question_count: 3,
    updated_at: new Date().toISOString(),
  },
];

export async function listForms(clinicId?: string | null): Promise<AxielForm[]> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");

    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("intake_forms")
      .select("id, clinic_id, name, description, category, is_active, updated_at, intake_questions(id)")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (clinicId) query = query.eq("clinic_id", clinicId);

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((form: any) => ({
      id: form.id,
      clinic_id: form.clinic_id,
      name: form.name,
      description: form.description,
      category: form.category ?? "Custom Form",
      status: form.is_active ? "Active" : "Draft",
      question_count: form.intake_questions?.length ?? 0,
      updated_at: form.updated_at,
    }));
  } catch {
    return demoForms;
  }
}

export async function getForm(id: string): Promise<(AxielForm & { questions: FormQuestion[] }) | null> {
  const template = FORM_TEMPLATES.find((item) => item.id === id);
  if (template) {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      status: "Draft",
      question_count: template.questions.length,
      updated_at: new Date().toISOString(),
      questions: template.questions.map((question, index) => ({ ...question, id: `${template.id}-${index + 1}` })),
    };
  }

  const fallback = demoForms.find((form) => form.id === id) ?? demoForms[0];
  return {
    ...fallback,
    questions: [
      { id: "q1", label: "What brings you in today?", question_type: "long_text", is_required: true, display_order: 1 },
      { id: "q2", label: "How strong is the discomfort today?", question_type: "scale_1_10", is_required: false, display_order: 2 },
      { id: "q3", label: "Mark any area of attention.", question_type: "body_map", is_required: false, display_order: 3 },
    ],
  };
}

export async function createForm(input: {
  clinic_id?: string | null;
  name: string;
  description?: string | null;
  category: string;
  is_active?: boolean;
  questions: Array<{ label: string; question_type: string; is_required: boolean; options?: string[] }>;
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
      category: input.category,
      is_active: input.is_active ?? false,
    })
    .select("*")
    .single();

  if (formError) throw formError;

  const rows = input.questions.map((question, index) => ({
    clinic_id: input.clinic_id,
    form_id: form.id,
    label: question.label,
    question_type: question.question_type,
    options: question.options ?? null,
    is_required: question.is_required,
    display_order: index + 1,
  }));

  if (rows.length) {
    const { error: questionsError } = await supabase.from("intake_questions").insert(rows);
    if (questionsError) throw questionsError;
  }

  return form;
}

export async function listPatientFormSubmissions(patientId: string): Promise<FormSubmissionSummary[]> {
  return [
    {
      id: `${patientId}-sub-1`,
      form_name: "Initial Patient Intake",
      completed_at: new Date().toISOString(),
      summary: "Sleep: irregular · Stress: moderate · Area of attention: lower back",
    },
    {
      id: `${patientId}-sub-2`,
      form_name: "Follow-up Progress Form",
      completed_at: new Date().toISOString(),
      summary: "Progress noted · Next Step reviewed · Follow-up suggested",
    },
  ];
}
