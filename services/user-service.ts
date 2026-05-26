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
  if (!data) return null;

  // Self-heal: if users.clinic_id is null, resolve from clinic_users and
  // patch the row so all subsequent API calls (which read users.clinic_id
  // directly) also work without needing per-route fallbacks.
  if (!data.clinic_id) {
    const { data: cu } = await supabase
      .from("clinic_users")
      .select("clinic_id")
      .eq("user_id", authUser.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (cu?.clinic_id) {
      // Best-effort write — if RLS blocks it the user still gets the
      // correct clinic_id for this request via the patched object.
      await supabase
        .from("users")
        .update({ clinic_id: cu.clinic_id })
        .eq("id", authUser.id);

      return { ...data, clinic_id: cu.clinic_id } as AppUser;
    }
  }

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
