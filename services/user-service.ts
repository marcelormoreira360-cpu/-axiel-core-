import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { AppUser } from "@/lib/types";

export async function getCurrentAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
}

export async function getCurrentUserProfile(): Promise<AppUser | null> {
  const authUser = await getCurrentAuthUser();
  if (!authUser) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getUsersForCurrentScope(): Promise<AppUser[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
