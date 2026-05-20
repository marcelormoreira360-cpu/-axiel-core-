import type { FollowUp, FollowUpChannel, FollowUpStatus } from "@/lib/types";

const FOLLOW_UP_SELECT = "*, patients(id, full_name, email, phone, status), appointments(id, starts_at, duration_minutes, notes)";

export async function getFollowUps(clinicId?: string): Promise<FollowUp[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  let query = supabase.from("follow_ups").select(FOLLOW_UP_SELECT).order("due_at", { ascending: true });

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FollowUp[];
}

export async function getPendingFollowUps(): Promise<FollowUp[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select(FOLLOW_UP_SELECT)
    .eq("status", "pending")
    .order("due_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as FollowUp[];
}

export async function getFollowUpsByPatient(patientId: string): Promise<FollowUp[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select(FOLLOW_UP_SELECT)
    .eq("patient_id", patientId)
    .order("due_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as FollowUp[];
}

export async function createFollowUp(input: {
  clinic_id: string;
  patient_id: string;
  appointment_id?: string | null;
  title: string;
  due_at: string;
  channel: FollowUpChannel;
  message_subject?: string | null;
  message_body?: string | null;
  notes?: string | null;
  ai_suggested_timing?: string | null;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("follow_ups")
    .insert({ ...input, created_by: user?.id ?? null })
    .select(FOLLOW_UP_SELECT)
    .single();

  if (error) throw error;
  return data as FollowUp;
}

export async function updateFollowUpStatus(id: string, status: FollowUpStatus) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .update({ status })
    .eq("id", id)
    .select(FOLLOW_UP_SELECT)
    .single();

  if (error) throw error;
  return data as FollowUp;
}
