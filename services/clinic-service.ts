import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Clinic } from "@/lib/types";

export async function getClinicsForUser(): Promise<Clinic[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCurrentClinic(): Promise<Clinic | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.clinic_id) return null;

  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
