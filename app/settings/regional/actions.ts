"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { updateClinicSettings } from "@/services/clinic-service";

export async function updateRegionalSettingsAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) return;

  const timezone = String(formData.get("timezone") ?? "").trim();
  const default_currency = String(formData.get("default_currency") ?? "").trim();

  await updateClinicSettings(profile.clinic_id as string, { timezone, default_currency });
  revalidatePath("/settings/regional");
}
