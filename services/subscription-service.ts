export async function getClinicSubscription(clinicId: string) {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(code, name, features)")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
