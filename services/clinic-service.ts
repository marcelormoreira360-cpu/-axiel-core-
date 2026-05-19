import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Clinic } from "@/lib/types";

export const ACTIVE_CLINIC_COOKIE = "axiel_active_clinic_id";

export async function getClinicsForUser(): Promise<Clinic[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateClinic(id: string, fields: { name?: string; slug?: string }): Promise<Clinic> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clinics")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getCurrentClinic(): Promise<Clinic | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Check cookie override first (multi-clinic switcher)
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_CLINIC_COOKIE)?.value;

  if (activeId) {
    const { data: overrideClinic } = await supabase
      .from("clinics").select("*").eq("id", activeId).maybeSingle();
    if (overrideClinic) return overrideClinic;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users").select("clinic_id").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.clinic_id) return null;

  const { data, error } = await supabase
    .from("clinics").select("*").eq("id", profile.clinic_id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createClinic(name: string): Promise<Clinic> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data, error } = await supabase
    .from("clinics").insert({ name, slug }).select("*").single();
  if (error) throw error;
  return data;
}
