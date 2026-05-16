import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ActionSuggestion, ActionSuggestionStatus } from "@/lib/types";
import type { ActionSuggestionDraft } from "@/modules/action-suggestions/action-rules";

const SELECT = "*";

export async function getActionSuggestions(options?: {
  clinicId?: string;
  status?: ActionSuggestionStatus[];
  limit?: number;
  entityType?: string;
  entityId?: string;
}): Promise<ActionSuggestion[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("action_suggestions").select(SELECT).order("created_at", { ascending: false });

  if (options?.clinicId) query = query.eq("clinic_id", options.clinicId);
  if (options?.status?.length) query = query.in("status", options.status);
  if (options?.entityType) query = query.eq("entity_type", options.entityType);
  if (options?.entityId) query = query.eq("entity_id", options.entityId);
  if (options?.limit) query = query.limit(Math.max(options.limit * 4, options.limit));

  const { data, error } = await query;
  if (error) throw error;

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const statusOrder: Record<string, number> = { accepted: 0, pending: 1, completed: 2, ignored: 3 };
  const sorted = ((data ?? []) as ActionSuggestion[]).sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return options?.limit ? sorted.slice(0, options.limit) : sorted;
}

export async function syncActionSuggestions(drafts: ActionSuggestionDraft[]) {
  if (drafts.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = drafts.map((draft) => ({
    ...draft,
    source: "system_rule" as const,
    status: "pending" as const,
    created_by: user?.id ?? null,
  }));

  const { data, error } = await supabase
    .from("action_suggestions")
    .upsert(rows, { onConflict: "clinic_id,action_key", ignoreDuplicates: true })
    .select(SELECT);

  if (error) throw error;
  return (data ?? []) as ActionSuggestion[];
}

export async function updateActionSuggestionStatus(id: string, status: ActionSuggestionStatus) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date().toISOString();
  const statusFields =
    status === "accepted"
      ? { accepted_at: now, ignored_at: null, completed_at: null }
      : status === "ignored"
        ? { ignored_at: now }
        : status === "completed"
          ? { completed_at: now }
          : {};

  const { data, error } = await supabase
    .from("action_suggestions")
    .update({ status, updated_by: user?.id ?? null, ...statusFields })
    .eq("id", id)
    .select(SELECT)
    .single();

  if (error) throw error;
  return data as ActionSuggestion;
}
