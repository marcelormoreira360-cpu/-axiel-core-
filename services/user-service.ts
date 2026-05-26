import { cache } from "react";
import type { AppUser } from "@/lib/types";

// React.cache deduplicates calls within a single request render tree.
// If getCurrentAuthUser / getCurrentUserProfile are called N times per page,
// only the first call hits the network; the rest return the cached result.

export const getCurrentAuthUser = cache(async () => {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
});

export const getCurrentUserProfile = cache(async (): Promise<AppUser | null> => {
  const authUser = await getCurrentAuthUser();
  if (!authUser) return null;

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) throw error;
  return data;
});

export async function getUsersForCurrentScope(): Promise<AppUser[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
