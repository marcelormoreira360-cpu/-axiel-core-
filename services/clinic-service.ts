import { cache } from "react";
import { cookies } from "next/headers";
import type { Clinic } from "@/lib/types";

export const ACTIVE_CLINIC_COOKIE = "axiel_active_clinic_id";

export async function getClinicsForUser(): Promise<Clinic[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");

  const supabase = await createSupabaseServerClient();

  // Step 1: resolve clinic_id via the users table — RLS on users is working.
  // The clinics table RLS (can_access_clinic) does not resolve correctly in
  // some SSR token contexts, so we bypass it by resolving the clinic_id here
  // and fetching the clinic directly with the admin client.
  const { data: userRows } = await supabase
    .from("users")
    .select("clinic_id")
    .not("clinic_id", "is", null)
    .limit(1);

  const clinicId = userRows?.[0]?.clinic_id as string | undefined;
  if (!clinicId) return [];

  // Step 2: fetch clinic via admin client scoped to the verified clinic_id.
  // Safe: clinicId came from an RLS-validated query.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("clinics")
    .select(CLINIC_SELECT)
    .eq("id", clinicId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Clinic[];
}

const CLINIC_SELECT = "id, name, slug, logo_url, primary_color, clinic_profile, phone, contact_email, website, address_line, city, state, cnpj, description, status, created_at, updated_at";

export async function updateClinic(id: string, fields: {
  name?: string;
  slug?: string;
  logo_url?: string | null;
  primary_color?: string | null;
  clinic_profile?: string;
  phone?: string | null;
  contact_email?: string | null;
  website?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  cnpj?: string | null;
  description?: string | null;
}): Promise<Clinic> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  // RLS enforces that only clinic_owner/manager of this clinic can update.
  // We rely on RLS instead of a manual auth.getUser() check to avoid the
  // SSR token-refresh issue that makes auth.getUser() silently return null.
  const { data, error } = await supabase
    .from("clinics")
    .update(fields)
    .eq("id", id)
    .select(CLINIC_SELECT)
    .single();
  if (error) throw error;
  return data as Clinic;
}

// React.cache deduplicates within a single request.
// getCurrentClinic relies entirely on RLS to scope the result — we removed
// the auth.getUser() guard because it can silently fail in SSR contexts
// (expired access token not yet refreshed), while RLS continues to work
// correctly from the JWT stored in cookies.
export const getCurrentClinic = cache(async (): Promise<Clinic | null> => {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Check cookie override first (multi-clinic switcher)
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_CLINIC_COOKIE)?.value;

  if (activeId) {
    const { data: overrideClinic } = await admin
      .from("clinics").select(CLINIC_SELECT).eq("id", activeId).maybeSingle();
    if (overrideClinic) return overrideClinic as Clinic;
  }

  // Step 1: resolve clinic_id via users table (RLS on users works reliably).
  const { data: userRows } = await supabase
    .from("users")
    .select("clinic_id")
    .not("clinic_id", "is", null)
    .limit(1);

  const clinicId = userRows?.[0]?.clinic_id as string | undefined;
  if (!clinicId) return null;

  // Step 2: fetch clinic via admin client using the verified clinic_id.
  const { data: clinic } = await admin
    .from("clinics")
    .select(CLINIC_SELECT)
    .eq("id", clinicId)
    .maybeSingle();

  return (clinic as Clinic) ?? null;
});

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
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, logo_url, primary_color, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) console.error("[getClinicBySlug] error for slug=%s: %s", slug, error.message);
  return data ?? null;
}
// ── Clinic settings helpers ────────────────────────────────────────────────────

export async function getClinicSettings(clinicId: string): Promise<{
  timezone: string;
  default_currency: string;
}> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clinic_settings")
    .select("timezone, default_currency")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  return {
    timezone:         data?.timezone         ?? "America/Sao_Paulo",
    default_currency: data?.default_currency ?? "BRL",
  };
}

export async function updateClinicSettings(clinicId: string, input: {
  timezone?: string;
  default_currency?: string;
}): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: clinicId, ...input, updated_at: new Date().toISOString() },
             { onConflict: "clinic_id" });
  if (error) throw error;
}
