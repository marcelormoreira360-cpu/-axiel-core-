export type TreatmentPlanStatus = "active" | "paused" | "completed" | "cancelled";

export type TreatmentPlanStep = {
  id: string;
  plan_id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  created_at: string;
};

export type TreatmentPlan = {
  id: string;
  clinic_id: string;
  patient_id: string;
  created_by: string | null;
  title: string;
  goal: string | null;
  status: TreatmentPlanStatus;
  started_at: string | null;
  target_end_at: string | null;
  /** Valor do plano em centavos (moeda da clínica). Opcional. */
  plan_value_cents: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  steps: TreatmentPlanStep[];
};

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getPatientTreatmentPlans(patientId: string): Promise<TreatmentPlan[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("treatment_plans")
    .select("*, treatment_plan_steps(*)")
    .eq("patient_id", patientId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((plan) => ({
    ...plan,
    steps: ((plan.treatment_plan_steps as TreatmentPlanStep[]) ?? []).sort(
      (a, b) => a.order_index - b.order_index,
    ),
  })) as TreatmentPlan[];
}

export async function getActiveTreatmentPlan(patientId: string): Promise<TreatmentPlan | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("treatment_plans")
    .select("*, treatment_plan_steps(*)")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    steps: ((data.treatment_plan_steps as TreatmentPlanStep[]) ?? []).sort(
      (a, b) => a.order_index - b.order_index,
    ),
  } as TreatmentPlan;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createTreatmentPlan(input: {
  clinic_id: string;
  patient_id: string;
  created_by?: string | null;
  title: string;
  goal?: string | null;
  started_at?: string | null;
  target_end_at?: string | null;
  plan_value_cents?: number | null;
  notes?: string | null;
}): Promise<TreatmentPlan> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("treatment_plans")
    .insert({
      clinic_id:        input.clinic_id,
      patient_id:       input.patient_id,
      created_by:       input.created_by ?? null,
      title:            input.title,
      goal:             input.goal ?? null,
      started_at:       input.started_at ?? new Date().toISOString().split("T")[0],
      target_end_at:    input.target_end_at ?? null,
      plan_value_cents: input.plan_value_cents ?? null,
      notes:            input.notes ?? null,
      status:           "active",
    })
    .select("*, treatment_plan_steps(*)")
    .single();

  if (error) throw error;
  return { ...data, steps: [] } as TreatmentPlan;
}

export async function updateTreatmentPlanStatus(
  planId: string,
  status: TreatmentPlanStatus,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("treatment_plans")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", planId);

  if (error) throw error;
}

export async function addTreatmentPlanStep(input: {
  plan_id: string;
  clinic_id: string;
  title: string;
  description?: string | null;
  order_index?: number;
  due_date?: string | null;
}): Promise<TreatmentPlanStep> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("treatment_plan_steps")
    .insert({
      plan_id:     input.plan_id,
      clinic_id:   input.clinic_id,
      title:       input.title,
      description: input.description ?? null,
      order_index: input.order_index ?? 0,
      due_date:    input.due_date ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as TreatmentPlanStep;
}

export async function toggleTreatmentPlanStep(
  stepId: string,
  completed: boolean,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("treatment_plan_steps")
    .update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", stepId);

  if (error) throw error;
}

export async function deleteTreatmentPlanStep(stepId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("treatment_plan_steps")
    .delete()
    .eq("id", stepId);

  if (error) throw error;
}
