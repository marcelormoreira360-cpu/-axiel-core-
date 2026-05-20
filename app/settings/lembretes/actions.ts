"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentClinic } from "@/services/clinic-service";

export async function toggleReminderAction(formData: FormData): Promise<void> {
  const key = String(formData.get("key")); // e.g. "d_minus_1"
  const enabled = formData.get("enabled") === "true";
  const supabase = await createSupabaseServerClient();
  const clinic = await getCurrentClinic();
  if (!clinic) return;

  // Read current settings
  const { data: current } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  const existing = (current?.settings as Record<string, unknown>) ?? {};
  const reminders = ((existing.reminders ?? {}) as Record<string, boolean>);
  reminders[key] = enabled;

  await supabase.from("clinic_settings").upsert(
    { clinic_id: clinic.id, settings: { ...existing, reminders } },
    { onConflict: "clinic_id" },
  );

  revalidatePath("/settings/lembretes");
}
