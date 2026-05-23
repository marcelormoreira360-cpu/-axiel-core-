import { cookies } from "next/headers";
import type { Clinic } from "@/lib/types";

export const ACTIVE_CLINIC_COOKIE = "axiel_active_clinic_id";

export async function getClinicsForUser(): Promise<Clinic[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  // Resolve user's clinic_id explicitly — defense-in-depth on top of RLS.
  // Without this, the query returns whatever RLS allows, which could expose
  // all clinics if a policy is misconfigured.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) return [];

  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, slug, logo_url, primary_color, clinic_profile, created_at, updated_at")
    .eq("id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Clinic[];
}

export async function updateClinic(id: string, fields: { name?: string; slug?: string; logo_url?: string | null; primary_color?: string | null; clinic_profile?: string }): Promise<Clinic> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  // Verify the caller owns this clinic before updating.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.clinic_id !== id) throw new Error("Acesso negado.");

  const { data, error } = await supabase
    .from("clinics")
    .update(fields)
    .eq("id", id)
    .select("id, name, slug, logo_url, primary_color, clinic_profile, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as Clinic;
}

export async function getCurrentClinic(): Promise<Clinic | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

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
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data, error } = await supabase
    .from("clinics").insert({ name, slug }).select("*").single();
  if (error) throw error;
  return data;
}

export async function getClinicBySlug(slug: string): Promise<Pick<import("@/lib/types").Clinic, "id" | "name" | "logo_url" | "primary_color" | "slug"> | null> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("clinics")
    .select("id, name, logo_url, primary_color, slug")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
}
